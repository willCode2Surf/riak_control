minispade.register('cluster', function() {

  /**
   * @class
   *
   * Responsible for modeling one specific cluster node.
   */
  RiakControl.CurrentClusterNode = Ember.Object.extend(
    /** @scope RiakControl.CurrentClusterNode.prototype */ {});

  /**
   * @class
   *
   * Responsible for modeling one specific cluster node.
   */
  RiakControl.StagedClusterNode = Ember.Object.extend(
    /** @scope RiakControl.StagedClusterNode.prototype */ {});

  /**
   * @class
   *
   * Responsible for modeling the current and staged cluster.
   */
  RiakControl.CurrentAndPlannedCluster = Ember.Object.extend(
    /** @scope RiakControl.CurrentAndPlannedCluster.prototype */ {});

  /**
   * @class
   *
   * ClusterController is responsible for display the list of nodes
   * in the cluster.  This controller is basically a placeholder and
   * wrapper around the legacy cluster page until we rewrite it.
   */
  RiakControl.ClusterController = Ember.ObjectController.extend(
    /** @scope RiakControl.ClusterController.prototype */ {

    /**
     * Initialize.
     *
     * @returns {void}
     */
    init: function() {
      this.set('content',
        RiakControl.CurrentAndPlannedCluster.create({
          stagedCluster: [], currentCluster: []
        }));
    },

    /**
     * Refresh a particular cluster, giving a cluster returned as JSON,
     * and a cluster modeled in Ember.
     *
     * Not computationally efficient at all, but explicit for debugging
     * the Ember bindings and propagation.
     *
     * @returns {void}
     */
    refresh: function(newCluster, existingCluster, nodeFactory) {
      newCluster.forEach(function(node) {
        var exists = existingCluster.findProperty('name', node.name);

        // If it doesn't exist yet, add it.  If it does, update it.
        if(exists !== undefined) {
          exists.setProperties(node);
        } else {
          existingCluster.pushObject(nodeFactory.create(node));
        }
      });

      // Iterate the cluster removing nodes that shouldn't
      // be there.
      var changesOccurred    = false;
      var replacementCluster = [];

      existingCluster.forEach(function(node, i) {
        var exists = newCluster.findProperty('name', node.name);

        if(exists === undefined) {
          node.destroy();
          changesOccurred = true;
        } else {
          replacementCluster.pushObject(node);
        }
      });

      if(changesOccurred) {
        existingCluster.set('[]', replacementCluster.get('[]'));
      }
    },

    /**
     * Load data from server.
     *
     * @returns {void}
     */
    load: function() {
      var self = this;

      $.ajax({
        type:     'GET',
        url:      '/admin/cluster',
        dataType: 'json',

        success: function(d) {
          var updatedCurrentCluster = d.cluster.current;
          var currentCurrentCluster = self.get('content.currentCluster');

          self.refresh(updatedCurrentCluster,
            currentCurrentCluster, RiakControl.CurrentClusterNode);

          var updatedStagedCluster = d.cluster.staged;

          if(updatedStagedCluster === 'ring_not_ready') {
            self.set('ring_not_ready', true);
          } else if (updatedStagedCluster === 'legacy') {
            self.set('legacy', true);
          } else {
            var currentStagedCluster = self.get('content.stagedCluster');

            self.refresh(updatedStagedCluster,
              currentStagedCluster, RiakControl.StagedClusterNode);
          }
        }
      });
    },

    /**
     * Reload data from server.
     *
     * @returns {void}
     */
    reload: function() {
      this.load();
    },

    /**
     * Called by the router to start the polling interval when the page
     * is selected.
     *
     * @returns {void}
     */
    startInterval: function() {
      this._intervalId = setInterval($.proxy(this.reload, this),
              RiakControl.refreshInterval);
    },

    /**
     * Called by the router to stop the polling interval when the page
     * is navigated away from.
     *
     * @returns {void}
     */
    cancelInterval: function() {
      if(this._intervalId) {
        clearInterval(this._intervalId);
      }
    },

    /**
     * If content is loading, return true.
     *
     * @returns {boolean}
     */
    isLoading: function () {
      return false;
    }.property(),

    /**
     * Holds a boolean tracking if the ring is legacy.
     */
    legacy: false,

    /**
     * Holds a boolean tracking if the ring is not yet ready.
     */
    ring_not_ready: false,

    /**
     * Return nodes from the current cluster which have not been deleted.
     *
     * @returns {Ember.Array}
     */
    activeCurrentCluster: function() {
      return this.get('content.currentCluster').filterProperty('isDestroyed', false);
    }.property('content.currentCluster', 'content.currentCluster.@each'),

    /**
     * Return nodes from the staged cluster which have not been deleted.
     *
     * @returns {Ember.Array}
     */
    activeStagedCluster: function() {
      return this.get('content.stagedCluster').filterProperty('isDestroyed', false);
    }.property('content.stagedCluster', 'content.stagedCluster.@each'),

    /**
     * There are various reasons we wouldn't want to display
     * the planned cluster.  If none of those reasons are present,
     * go ahead and show the whole planned cluster view.
     *
     * @returns {boolean}
     */
    displayPlan: function () {
      var numStages = this.get('activeStagedCluster.length');

      return !this.get('isLoading') &&
             !this.get('ring_not_ready') &&
             !this.get('legacy') &&
             numStages > 0;
    }.property('isLoading',
               'ring_not_ready',
               'legacy',
               'activeStagedCluster.length')
  });

  /**
   * @class
   *
   * ClusterView is responsible for display the list of nodes
   * in the cluster.  This controller is basically a placeholder and
   * wrapper around the legacy cluster page until we rewrite it.
   */
  RiakControl.ClusterView = Ember.View.extend(
    /** @scope RiakControl.ClusterView.prototype */ {
    templateName: 'cluster'
  });

  /**
   * @class
   *
   * ClearPlanButton is responsible for clearing the staged plan.
   */
  RiakControl.ClearPlanButtonView = Ember.View.extend(
    /** @scope RiakControl.ClearPlanButtonView.prototype */ {
    tagName:    'a',
    classNames: ['gui-rect-button', 'gui-text-bold'],

    click: function(ev) {
      ev.preventDefault();

      var self = this;

      $.ajax({
        type:     'DELETE',
        url:      '/admin/cluster',
        dataType: 'json',

        success: function(d) {
          self.get('controller').reload();
        }
      });
    }
  });

  /**
   * @class
   *
   * Toggle button for a current cluster node to expand actions.
   */
  RiakControl.CurrentClusterToggleView = Ember.View.extend(
    /** @scope RiakControl.CurrentClusterToggleView.prototype */ {

    /**
     * Handle click event on the action toggle.
     *
     * @returns {void}
     */
    click: function () {
      var prop = this.get('parentView.expanded');

      if (prop) {
        this.get('parentView').set('expanded', false);
      } else {
        this.get('parentView').set('expanded', true);
      }
    }
  });

  /**
   * @class
   *
   * One item in the collection of current cluster views.
   */
  RiakControl.CurrentClusterItemView = Ember.View.extend(
    /** @scope RiakControl.CurrentClusterItemView.prototype */ {

    /* Bindings from the model */

    templateName:       'current_cluster_item',
    nameBinding:        'content.name',
    reachableBinding:   'content.reachable',
    statusBinding:      'content.status',
    ring_pctBinding:    'content.ring_pct',
    mem_totalBinding:   'content.mem_total',
    mem_usedBinding:    'content.mem_used',
    mem_erlangBinding:  'content.mem_erlang',

    classNameBindings:  ['expanded:open'],

   /**
    * Color the lights appropriately based on the node status.
    *
    * @returns {string}
    */
    indicatorLights: function() {
      var status = this.get('status');
      var reachable = this.get('reachable');
      var color;

      if(reachable === false) {
        color = "red";
      } else if(status === 'leaving' || status === 'joining') {
        color = "orange";
      } else if (status === 'valid') {
        color = "green";
      } else {
        color = "grey";
      }

      return "gui-light status-light inline-block " + color;
    }.property('reachable', 'status'),

    /**
     * Normalizer.
     *
     * @returns {number}
     */
    mem_divider: function() {
      return this.get('mem_total') / 100;
    }.property('mem_total'),

    /**
     * Compute memory ceiling.
     *
     * @returns {number}
     */
    mem_erlang_ceil: function () {
      return Math.ceil(this.get('mem_erlang') / this.get('mem_divider'));
    }.property('mem_erlang', 'mem_divider'),

    /**
     * Compute free memory from total and used.
     *
     * @returns {number}
     */
    mem_non_erlang: function () {
      return Math.round(
          (this.get('mem_used') / this.get('mem_divider')) - this.get('mem_erlang_ceil'));
    }.property('mem_used', 'mem_divider', 'mem_erlang_ceil'),

    /**
     * Compute free memory from total and used.
     *
     * @returns {number}
     */
    mem_free: function () {
      return this.get('mem_total') - this.get('mem_used');
    }.property('mem_total', 'mem_used'),

    /**
     * Format free memory to be a readbale version.
     *
     * @returns {number}
     */
    mem_free_readable: function () {
      return Math.round(this.get('mem_free') / this.get('mem_divider'));
    }.property('mem_free', 'mem_divider'),

    /**
     * Format used memory to be a readbale version.
     *
     * @returns {number}
     */
    mem_used_readable: function () {
      return Math.round((this.get('mem_total') - this.get('mem_free')) /
          this.get('mem_divider'));
    }.property('mem_total', 'mem_free', 'mem_divider'),

    /**
     * Return CSS style for rendering memory used by Erlang.
     *
     * @returns {number}
     */
    mem_erlang_style: function () {
      return 'width: ' + this.get('mem_erlang_ceil') + '%';
    }.property('mem_erlang_ceil'),

    /**
     * Return CSS style for rendering occupied non-erlang memory.
     *
     * @returns {string}
     */
    mem_non_erlang_style: function () {
      return 'width: ' + this.get('mem_non_erlang') + '%';
    }.property('mem_non_erlang'),

    /**
     * Return CSS style for rendering free memory.
     *
     * @returns {string}
     */
    mem_free_style: function () {
      return 'width: ' + this.get('mem_free_readable') + '%';
    }.property('mem_free_readable'),

    /**
     * Formatted ring percentage.
     *
     * @returns {string}
     */
    ring_pct_readable: function () {
      return this.get('ring_pct') * 100;
    }.property('ring_pct')

  });

  /**
   * @class
   *
   * Collection view for showing the current cluster.
   */
  RiakControl.CurrentClusterView = Ember.CollectionView.extend(
    /** @scope RiakControl.CurrentClusterView.prototype */ {
    itemViewClass: RiakControl.CurrentClusterItemView
  });

  /**
   * @class
   *
   * One item in the collection of current cluster views.
   */
  RiakControl.StagedClusterItemView = Ember.View.extend(
    /** @scope RiakControl.StagedClusterItemView.prototype */ {

    /* Bindings from the model */

    templateName:       'staged_cluster_item',
    nameBinding:        'content.name',
    statusBinding:      'content.status',
    ring_pctBinding:    'content.ring_pct',

    /* Necessary rename to avoid collision */
    node_actionBinding: 'content.action',

    /**
     * Does the node have a replacement?
     *
     * @returns {boolean}
     */
    isReplaced: function() {
      return this.get('content.replacement') !== "undefined" ? true : false;
    }.property('content.replacement'),

    /**
     * Is the node taking an action?
     *
     * @returns {boolean}
     */
    isAction: function() {
        return this.get('content.action') !== "undefined" ? true : false;
    }.property('content.action'),

    /**
     * Color the lights appropriately based on the node status.
     *
     * @returns {string}
     */
     indicatorLights: function() {
       var status = this.get('status');
       var reachable = this.get('reachable');
       var color;

       if(reachable === false) {
         color = "red";
       } else if(status === 'leaving' || status === 'joining') {
         color = "orange";
       } else if (status === 'valid') {
         color = "green";
       } else {
         color = "grey";
       }

       return "gui-light status-light inline-block " + color;
     }.property('reachable', 'status'),

    /**
     * Formatted ring percentage.
     *
     * @returns {string}
     */
    ring_pct_readable: function () {
      return this.get('ring_pct') * 100;
    }.property('ring_pct')

  });

  /**
   * @class
   *
   * Collection view for showing the staged cluster.
   */
  RiakControl.StagedClusterView = Ember.CollectionView.extend(
    /** @scope RiakControl.StagedClusterView.prototype */ {
    itemViewClass: RiakControl.StagedClusterItemView
  });

});
