if(Meteor.isServer) {
  var Future = Npm.require('fibers/future');

  Stream.await = function(promise) {
    var fut = new Future();

    promise.then(fut.return.bind(fut), 
      function(err) {
        if(err.status_code && err.detail) {
          fut.throw('Feed request failed with code: ' + err.status_code + ' and detail: ' + err.detail);
        } else {
          fut.throw('Getstream.io API request failed with error', err);
        }
    });

    return fut.wait();
  };
}

FeedManager = function () {
  this.initialize.apply(this, arguments);
};

FeedManager.prototype = {

  initialize: function(settings) {
    this.settings = settings;

    options = {};

    if (this.settings.apiLocation !== '') {
      options.location = this.settings.apiLocation;
    }

    if (typeof(process) !== "undefined" && process.env.STREAM_URL) {
      this.client = Stream.stream.connect();
    } else {
      this.client = Stream.stream.connect(this.settings.apiKey, this.settings.apiSecret, this.settings.apiAppId, options);
    }
  
  },

  databrowserLink: function(feed) {
    return `https://getstream.io/dashboard/databrowser/${this.settings.appId}/${feed.slug}/${feed.id}`;
  },

  trackingEnabled: function(instance) {
    return process.env.NODE_ENV === 'test' ? false : true;
  },

  getUserFeed: function(userId, token) {
    return this.client.feed(this.settings.userFeed, userId, token);
  },

  getUserFeedToken: function(userId) {
    return this.client.feed(this.settings.userFeed, userId).token;
  },

  getNotificationFeed: function(userId, token) {
    return this.client.feed(this.settings.notificationFeed, userId, token);
  },

  getNotificationFeedToken: function(userId) {
    return this.client.feed(this.settings.notificationFeed, userId).token;
  },
  
  getNewsFeeds: function(userId, token) {
    feeds = [];
    newsFeeds = this.settings.newsFeeds;

    for (key in newsFeeds) {
      slug = newsFeeds[key];
      feeds[slug] = this.client.feed(slug, userId, token);
    }

    return feeds;
  },

  getNewsFeedsTokens: function(userId) {
    var feeds = this.getNewsFeeds(userId);

    for(let feed of Object.keys(feeds)) {
      feeds[feed] = feeds[feed].token;
    }

  return feeds;
  },

  followUser: function(userId, targetUserId) {
    newsFeeds = this.getNewsFeeds(userId);

    for (slug in newsFeeds) {
      newsFeeds[slug].follow(this.settings.userFeed, targetUserId);
    }
  },

  unfollowUser: function(userId, targetUserId) {
    newsFeeds = this.getNewsFeeds(userId);

    for (slug in newsFeeds) {
      newsFeeds[slug].unfollow(this.settings.userFeed, targetUserId);
    }
  },

  getFeed: function(slug, userId, token) {
    return this.client.feed(slug, userId, token);
  },

  activityCreated: function(instance) {
    if (this.trackingEnabled(instance)) {
      var activity = instance.createActivity();
      var backend = instance.getStreamBackend();
      backend.serializeActivities([activity]);
      var feedType = instance.activityActorFeed() || this.settings.userFeed;
      var userId = backend.getIdFromRef(activity.actor);
      feed = this.getFeed(feedType, userId);
      feed.addActivity(activity, function(err, response, body) {
        if (err) console.log('err: ', err);
      });
    }
  },

  activityDeleted: function(instance) {
    if (this.trackingEnabled(instance)) {
      var activity = instance.createActivity();
      var backend = instance.getStreamBackend();
      backend.serializeActivities([activity]);
      var feedType = instance.activityActorFeed() || this.settings.userFeed;
      var userId = backend.getIdFromRef(activity.actor);
      feed = this.getFeed(feedType, userId);
      feed.removeActivity({'foreignId': activity.foreign_id}, function(err, response, body) {
        if (err) console.log('err: ', err);
      });
    }
  }

};