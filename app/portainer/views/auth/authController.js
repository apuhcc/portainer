angular.module('portainer.app')
.controller('AuthenticationController', ['$q', '$scope', '$state', '$transition$', '$sanitize', '$location', '$window', 'Authentication', 'UserService', 'EndpointService', 'StateManager', 'Notifications', 'SettingsService',
function ($q, $scope, $state, $transition$, $sanitize, $location, $window, Authentication, UserService, EndpointService, StateManager, Notifications, SettingsService) {

  $scope.logo = StateManager.getState().application.logo;

  $scope.formValues = {
    Username: '',
    Password: ''
  };

  $scope.state = {
    AuthenticationError: ''
  };
  
  SettingsService.publicSettings()
  .then(function success(settings) {
    $scope.AuthenticationMethod = settings.AuthenticationMethod;
    $scope.ClientID = settings.ClientID;
    $scope.RedirectURI = settings.RedirectURI;
    $scope.Scopes = settings.Scopes;
    $scope.AuthorizationURI = settings.AuthorizationURI;
  });


  $scope.authenticateUser = function() {
    var username = $scope.formValues.Username;
    var password = $scope.formValues.Password;

    Authentication.login(username, password)
    .then(function success() {
      checkForEndpoints();
    })
    .catch(function error() {
      SettingsService.publicSettings()
      .then(function success(settings) {
        if (settings.AuthenticationMethod === 1) {
          return Authentication.login($sanitize(username), $sanitize(password));
        }
        return $q.reject();
      })
      .then(function success() {
        $state.go('portainer.updatePassword');
      })
      .catch(function error() {
        $scope.state.AuthenticationError = 'Invalid credentials';
      });
    });
  };

  function unauthenticatedFlow() {
    EndpointService.endpoints()
    .then(function success(endpoints) {
      if (endpoints.length === 0) {
        $state.go('portainer.init.endpoint');
      } else {
        $state.go('portainer.home');
      }
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to retrieve endpoints');
    });
  }

  function authenticatedFlow() {
    UserService.administratorExists()
    .then(function success(exists) {
      if (!exists) {
        $state.go('portainer.init.admin');
      }
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to verify administrator account existence');
    });
  }

  function checkForEndpoints() {
    EndpointService.endpoints()
    .then(function success(data) {
      var endpoints = data;
      var userDetails = Authentication.getUserDetails();

      if (endpoints.length === 0 && userDetails.role === 1) {
        $state.go('portainer.init.endpoint');
      } else {
        $state.go('portainer.home');
        $window.location.search = '';
      }
    })
    .catch(function error(err) {
      Notifications.error('Failure', err, 'Unable to retrieve endpoints');
    });
  }

  function initView() {
    if ($transition$.params().logout || $transition$.params().error) {
      Authentication.logout();
      $scope.state.AuthenticationError = $transition$.params().error;
      return;
    }

    if (Authentication.isAuthenticated()) {
      $state.go('portainer.home');
    }

    var authenticationEnabled = $scope.applicationState.application.authentication;
    if (!authenticationEnabled) {
      unauthenticatedFlow();
    } else {
      authenticatedFlow();
    }
  }

  function oAuthLogin(code) {
    Authentication.oAuthLogin(code)
    .then(function success() {
      $state.go('portainer.home');
      $window.location.search = '';
    })
    .catch(function error() {
      $scope.state.AuthenticationError = 'Failed to authenticate with OAuth2 Provider';
    });
  }

  function getParameter(param) {
    var URL = $location.absUrl();
    var params = URL.split('?')[1];
    if (params === undefined) {
      return null;
    }
    params = params.split('&');
    for (var i = 0; i < params.length; i++) {
      var parameter = params[i].split('=');
        if (parameter[0] === param) {
          return parameter[1].split('#')[0];
        }
    }
    return null;
  }

  initView();
  if (getParameter('code') !== null) {
    oAuthLogin(getParameter('code'));
  }
}]);
