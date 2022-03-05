const { AuthenticationError } = require("apollo-server-express");
const { User, Portfolio } = require("../models");
const { signToken } = require("../utils/auth");

const resolvers = {
  Query: {
    users: async () => {
      return User.find()
        .populate("portfolios")
        .populate("followers")
        .populate("followings");
    },
    user: async (parent, { username }) => {
      return User.findOne({ username })
        .populate("portfolios")
        .populate("followers")
        .populate("followings");
    },
    portfolios: async (parent, { username }) => {
      const params = username ? { username } : {};
      return Portfolio.find(params).sort({ createdAt: -1 });
    },
    portfolio: async (parent, { portfolioId }) => {
      return Portfolio.findOne({ _id: portfolioId });
    },
    me: async (parent, args, context) => {
      if (context.user) {
        return User.findOne({ _id: context.user._id })
          .populate("portfolios")
          .populate("followers")
          .populate("followings");
      }
      throw new AuthenticationError("You need to be logged in");
    },

    followers: async (parent, { username }) => {
      const params = username ? { username } : {};
      return User.find(params).populate("followers").sort({ createdAt: -1 });
    },

    followings: async (parent, { username }) => {
      const params = username ? { username } : {};
      return User.find(params).populate("followings").sort({ createdAt: -1 });
    },
  },

  Mutation: {
    // USER
    addUser: async (parent, { username, email, password }) => {
      const user = await User.create({ username, email, password });
      const token = signToken(user);
      return { token, user };
    },

    login: async (parent, { email, password }) => {
      console.log(email);
      const user = await User.findOne({ email });
      if (!user) {
        throw new AuthenticationError("No user found with this email address");
      }
      const correctPw = await user.isCorrectPassword(password);
      if (!correctPw) {
        throw new AuthenticationError("Incorrect credentials");
      }
      const token = signToken(user);
      return { token, user };
    },

    // You can input any userId but it will only remove the user who is logged instead of throwing an error that states they need to be logged in
    removeUser: async (parent, arg, context) => {
      if (context.user) {
        return User.findOneAndDelete({ _id: context.user._id });
      }
      throw new AuthenticationError('You need to be logged in!');
    },

    updateUser: async (parent, args, context) => {
      if (context.user) {
        return await User.findByIdAndUpdate(context.user._id, args, {
          new: true,
        });
      }
      throw new AuthenticationError("You need to be logged in");
    },

    // PORTFOLIO

    // Works
    addPortfolio: async (parent, { portfolioText, portfolioImage, portfolioLink }, context) => {
      if (context.user) {
        const portfolio = await Portfolio.create({
          portfolioText,
          portfolioImage,
          portfolioLink,
          portfolioAuthor: context.user.username,
        });
        await User.findOneAndUpdate(
          { _id: context.user._id },
          { $addToSet: { portfolios: portfolio._id } }
        );
        return portfolio;
      }
      throw new AuthenticationError("You need to be logged in");
    },

    // Will remove the portfolio of the user that is logged in, otherwise it just returns as null if it's another persons portfolioID, rather than throwing an error
    removePortfolio: async (parent, { portfolioId }, context) => {
      if (context.user) {
        const portfolio = await Portfolio.findOneAndDelete({
          _id: portfolioId,
          portfolioAuthor: context.user.username
        });
        await User.findOneAndUpdate(
          { _id: context.user._id },
          { $pull: { portfolios: portfolioId } }
        );
        return portfolio;
      }
      throw new AuthenticationError("You need to be logged in!");
    },

    // Works
    updatePortfolio: async (parent, { portfolioId, portfolioText, portfolioImage, portfolioLink }, context) => {
      if (context.user) {
        const portfolio = await Portfolio.findById({ _id: portfolioId });
        console.log(`This is portfolio ${portfolio}`);
        if (context.user.username == portfolio.portfolioAuthor) {
          await portfolio.updateOne(
            {
              portfolioText,
              portfolioImage,
              portfolioLink,
              portfolioAuthor: context.user.username,
            },
            {
              new: true,
              runValidators: true,
            }
          );
          await User.findOneAndUpdate(
            { _id: context.user._id },
            { $set: { portfolios: portfolio._id } },
            {
              new: true,
              runValidators: true,
            }
          );
          return portfolio;
        }
        throw new AuthenticationError("You can only update your portfolio");
      }
      throw new AuthenticationError("You need to be logged in");
    },

    // RATING

    // Still can rate multiple times and your own portfolio (however, all social media websites let you rate your own posts)
    addRating: async (parent, { portfolioId, ratingNumber }, context) => {
      if (context.user) {
        const portfolio = await Portfolio.findById({ _id: portfolioId });
        if (context.user.username == portfolio.portfolioAuthor) {
          throw new AuthenticationError("You can not give rating to your portfolio");
        }
        return Portfolio.findOneAndUpdate(
          { _id: portfolioId },
          {
            $addToSet: {
              ratings: { ratingNumber, ratingAuthor: context.user.username },
            },
          },
          {
            new: true,
            runValidators: true,
          }
        );
      }
      throw new AuthenticationError("You need to be logged in");
    },

    // Will remove the rating of the user that is logged in, otherwise it is displaying the id that you attempted to remove from another user but it doesn't actually remove it --> does all of this instead of throwing an error
    removeRating: async (parent, { portfolioId, ratingId }, context) => {
      if (context.user) {
        return Portfolio.findOneAndUpdate(
          { _id: portfolioId },
          {
            $pull: {
              ratings: {
                _id: ratingId,
                ratingAuthor: context.user.username
              },
            },
          },
          { new: true }
        );
      }
      throw new AuthenticationError('You need to be logged in!');
    },

    //Works
    updateRating: async (parent, { portfolioId, ratingNumber }, context) => {
    if (context.user) {
      return Portfolio.findOneAndUpdate(
        { _id: portfolioId },
        {
          $set: {
            ratings: { ratingNumber, ratingAuthor: context.user.username },
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );
    }
    throw new AuthenticationError("You need to be logged in");
  },

  // FEEDBACK
  addFeedback: async (parent, { portfolioId, feedbackText }, context) => {
    if (context.user) {
      return Portfolio.findOneAndUpdate(
        {
          _id: portfolioId,
        },
        {
          $addToSet: {
            feedbacks: {
              feedbackText,
              feedbackAuthor: context.user.username,
            },
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );
    }
    throw new AuthenticationError("You need to be logged in");
  },

  removeFeedback: async (parent, { portfolioId, feedbackId }, context) => {
    if (context.user) {
      return Portfolio.findOneAndUpdate(
        { _id: portfolioId },
        {
          $pull: {
            feedbacks: {
              _id: feedbackId,
              feedbackAuthor: context.user.username,
            },
          },
        },
        { new: true }
      );
    }
    throw new AuthenticationError("You need to be logged in");
  },

  updateFeedback: async (parent, { portfolioId, feedbackText, feedbackId }, context) => {
    if (context.user) {
      let portfolioData = await Portfolio.findById({
        _id: portfolioId,
      });
      let modElement = portfolioData.feedbacks.map((feedback) => {
        console.log("265", feedback);
        if (feedback._id == feedbackId) {
          return Object.assign(feedback, { feedbackText });
        }
        return feedback;
      });

      return Portfolio.findByIdAndUpdate(
        {
          _id: portfolioId,
        },
        { feedbacks: modElement }
      );
    }
    throw new AuthenticationError("You need to be logged in");
  },

  // Follow a user and updates their followers list
  followUser: async (parent, { userId }, context) => {
    if (context.user) {
      const user = await User.find({
        _id: context.user._id,
        followings: userId,
      });
      if (context.user._id == userId) {
        throw new AuthenticationError("You can not follow yourself");
      }
      if (user.length > 0) {
        throw new AuthenticationError("You have already followed this user");
      }
      const updatedFollowings = await User.findOneAndUpdate(
        { _id: context.user._id },
        { $push: { followings: userId } },
        {
          new: true,
          runValidators: true,
        }
      );
      await User.findOneAndUpdate(
        { _id: userId },
        { $push: { followers: context.user._id } },
        {
          new: true,
          runValidators: true,
        }
      );
      return updatedFollowings;
    }
    throw new AuthenticationError("You need to be logged in");
  },

  // Unfollow a user and updates their followers list
  unfollowUser: async (parent, { userId }, context) => {
    if (context.user) {
      const updatedFollowings = await User.findOneAndUpdate(
        { _id: context.user._id },
        { $pull: { followings: userId } },
        {
          new: true,
          runValidators: true,
        }
      );
      await User.findOneAndUpdate(
        { _id: userId },
        { $pull: { followers: context.user._id } },
        {
          new: true,
          runValidators: true,
        }
      );
      return updatedFollowings;
    }
    throw new AuthenticationError("You need to be logged in");
  },
},
};

module.exports = resolvers;
