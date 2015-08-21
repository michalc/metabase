'use strict';
/*global _*/

import MetabaseAnalytics from '../lib/analytics';


//  Dashboard Controllers
var DashboardControllers = angular.module('corvus.dashboard.controllers', []);

DashboardControllers.controller('DashList', ['$scope', '$location', 'Dashboard', function($scope, $location, Dashboard) {
    $scope.dashboards = [];

    var refreshListing = function() {
        Dashboard.list({
            'filterMode': 'all'
        }, function (dashes) {
            $scope.dashboards = dashes;
        }, function (error) {
            console.log('error getting dahsboards list', error);
        });
    };

    $scope.$on("dashboard:create", function(event, dashboardId) {
        refreshListing();
    });

    $scope.$on("dashboard:delete", function(event, dashboardId) {
        refreshListing();
    });

    $scope.$on("dashboard:update", function(event, dashboardId) {
        refreshListing();
    });

    // always initialize with a fresh listing
    refreshListing();

}]);

import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware, combineReducers, compose } from 'redux';
import { devTools, persistState } from 'redux-devtools';
import { LogMonitor } from 'redux-devtools/lib/react';

import promiseMiddleware from 'redux-promise';
import loggerMiddleware from 'redux-logger';
import thunkMidleware from "redux-thunk";

import DashboardApp from './containers/DashboardApp.react';
import * as reducers from './reducers';

const finalCreateStore = compose(
  applyMiddleware(
      thunkMidleware,
      promiseMiddleware/*,
      loggerMiddleware*/
  ),
  // devTools(),
  // persistState(window.location.href.match(/[?&]debug_session=([^&]+)\b/)),
  createStore
);

const reducer = combineReducers(reducers);

DashboardControllers.controller('Dashboard', ['$scope', '$routeParams', '$location', 'VisualizationSettings', function($scope, $routeParams, $location, VisualizationSettings) {
    $scope.Component = DashboardApp;
    $scope.props = {
        visualizationSettingsApi: VisualizationSettings,
        onChangeLocation: function(url) {
            $scope.$apply(() => $location.url(url))
        }
    };
    $scope.store = finalCreateStore(reducer, { selectedDashboard: $routeParams.dashId });
    // $scope.monitor = LogMonitor;
}]);

DashboardControllers.controller('DashDetail', ['$scope', '$routeParams', '$location', 'Dashboard', 'DashCard', function($scope, $routeParams, $location, Dashboard, DashCard) {
    // $scope.dashboard: single Card being displayed/edited
    // $scope.error: any relevant error message to be displayed

    $scope.dashboardLoaded = false;
    $scope.dashboardLoadError = null;
    $scope.editingText = "Edit layout";

    $scope.cardSettings = {
        "allowFavorite":true,
        "allowAddToDash":true,
        "allowCardPermalink":true,
        "allowLinkToComments":true,
        "allowSend":true,
        "allowChangeCardSize": true,
        "allowTitleEdits": false
    };

    $scope.gridsterOptions = {
        columns: 6,
        /* Cards height collapses to 0 if window size < mobileBreakPoint,
         * preventing cards from rendering properly. Also happens if browser
         * window is set to < 600px, even without mobileBreakPoint set.
         */
        //mobileBreakPoint: 640,
        saveGridItemCalculatedHeightInMobile: true,
        floating: false,
        pushing: false,
        swapping: true,
        resizable: {
            enabled: false,
            handles: ['n', 's', 'e', 'w', 'se', 'sw'],
            stop: processResize
        },
        draggable: {
            enabled: false,
            stop: savePosition
        }
    };

    function processResize(event, $element, item){
        $element.scope().$broadcast('cv-gridster-item-resized', $element);
        savePosition();
    }

    function savePosition() {
        Dashboard.reposition_cards({
            'dashId': $scope.dashboard.id,
            'cards': $scope.dashcards
        });
    }


    $scope.toggleDashEditMode = function() {
        if ($scope.editingClass == "Dash--editing") {
            $scope.editingClass = "";
        } else {
            $scope.editingClass = "Dash--editing";
        }
        if ($scope.editingText == "Done") {
            $scope.editingText = "Edit layout";
        }
        else {
            $scope.editingText = "Done";
        }
        $scope.gridsterOptions.draggable.enabled = !$scope.gridsterOptions.draggable.enabled;
        $scope.gridsterOptions.resizable.enabled = !$scope.gridsterOptions.resizable.enabled;

        // Tracking
        if ($scope.gridsterOptions.resizable.enabled) {
            MetabaseAnalytics.trackEvent('Dashboard', 'Rearrange Finished');
        } else {
            MetabaseAnalytics.trackEvent('Dashboard', 'Rearrange Started');
        }
    };

    $scope.notifyDashboardSaved = function(dashboard) {
        // our saver is telling us the dashboard has been updated, so carry over a few things to our locally scoped dashboard
        // TODO: this is pretty manual and kludgy, look for a better way
        $scope.dashboard.name = dashboard.name;
        $scope.dashboard.descrption = dashboard.description;
        $scope.dashboard.public_perms = dashboard.public_perms;
        $scope.dashboard.updated_at = dashboard.updated_at;
    };

    $scope.removeCard = function(idx) {
        Dashboard.removecard({
            'dashId': $routeParams.dashId,
            'dashcardId': $scope.dashboard.ordered_cards[idx].id
        }, function(result) {
            $scope.dashboard.ordered_cards.splice(idx, 1);
        });
    };


    // note that we ALWAYS expect to be loading a specified dashboard
    Dashboard.get({
        'dashId': $routeParams.dashId
    }, function(result) {
        // add a quick indicator if the user viewing this dashboard is the owner.  this helps us with perm checking
        if ($scope.user.id === result.dashboard.creator_id) {
            result.dashboard.is_creator = true;
        }

        $scope.dashboard = result.dashboard;

        var cards = result.dashboard.ordered_cards;

        $scope.dashcards = cards;
        $scope.dashboardLoaded = true;

    }, function (error) {
        $scope.dashboardLoaded = true;

        if (error.status == 404) {
            $location.path('/');
        } else if (error.message) {
            $scope.dashboardLoadError = error.message;
        } else {
            $scope.dashboardLoadError = "Hmmm.  We had a problem loading this dashboard for some reason :(";
        }
    });

}]);
