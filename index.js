require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin Initialized Successfully");
} catch (error) {
  console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT.");
}

app.use(cors());
app.use(express.json());

//middleware

const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);

    req.token_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

app.get("/", (req, res) => {
  res.send("Taste tribe Server is Running");
});

//mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@shanto.jdnmzty.mongodb.net/?appName=shanto`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    const db = client.db("taste_tribe_DB");
    const reviewCollection = db.collection("reviews");
    const favoriteReviewsCollection = db.collection("Favorite_Reviews");
    const usersCollection = db.collection("users");

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      // console.log(req);
      const email = req.token_email;

      const query = { email: email };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //users api's

    app.post("/users", async (req, res) => {
      const user = req.body;

      // Prevent duplicate users
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne({ ...user, role: "user" });
      res.send(result);
    });

    app.get("/users", verifyFirebaseToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email", verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;

      if (req.token_email !== email) {
        return res
          .status(403)
          .send({ message: "Forbidden: You can only access your own data." });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    app.patch("/users/:email", verifyFirebaseToken, async (req, res) => {
      const email = req.params.email;
      const user = req.body;

      // 1. Security Check: Ensure the requester is updating their own profile
      if (email !== req.token_email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const updatedDoc = {
        $set: {
          name: user.name,
          photoURL: user.photoURL,
          // We can also add a timestamp if you want
          lastUpdated: new Date(),
        },
      };

      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: { role: "admin" } };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.patch(
      "/users/user/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        const userToDemote = await usersCollection.findOne({
          _id: new ObjectId(id),
        });
        if (req.token_email === userToDemote?.email) {
          return res
            .status(400)
            .send({ message: "Admin cannot change their own role." });
        }

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: { role: "user" } };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // DELETE a user (admin)
    app.delete(
      "/users/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        const userToDelete = await usersCollection.findOne({
          _id: new ObjectId(id),
        });
        if (req.token_email === userToDelete.email) {
          return res
            .status(400)
            .send({ message: "Admin cannot delete their own account." });
        }

        const query = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(query);
        res.send(result);
      }
    );

    // review api's

    app.post("/reviews", verifyFirebaseToken, async (req, res) => {
      const newReview = req.body;
      newReview.rating = parseInt(newReview.rating, 10);
      newReview.postedDate = new Date();
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
    });

    app.get("/all-reviews", async (req, res) => {
      try {
        const {
          search = "",
          rating = 0,
          sort = "newest",
          page = 1,
          limit = 9,
        } = req.query;

        const filterQuery = {};
        if (search) {
          filterQuery.foodName = { $regex: search, $options: "i" };
        }
        if (Number(rating) > 0) {
          filterQuery.rating = { $gte: Number(rating) };
        }
        let sortQuery = {};
        if (sort === "highest_rated") {
          sortQuery = { rating: -1, postedDate: -1 };
        } else {
          sortQuery = { postedDate: -1 };
        }

        const totalCount = await reviewCollection.countDocuments(filterQuery);
        const reviews = await reviewCollection
          .find(filterQuery)
          .sort(sortQuery)
          .skip((Number(page) - 1) * Number(limit))
          .limit(Number(limit))
          .toArray();

        res.send({
          reviews,
          totalCount,
        });
      } catch (error) {
        console.error("Error fetching all reviews:", error);
        res.status(500).send({ message: "Failed to fetch reviews." });
      }
    });

    app.get("/featured-reviews", async (req, res) => {
      const cursor = reviewCollection.find().sort({ rating: -1 }).limit(8);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.findOne(query);
      res.send(result);
    });

    app.get("/my-reviews", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.reviewerEmail = email;
        if (email !== req.token_email) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
      }
      const cursor = reviewCollection.find(query).sort({ postedDate: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.patch("/reviews/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const updateReview = req.body;
      const query = { _id: new ObjectId(id) };
      const update = { $set: updateReview };
      const result = await reviewCollection.updateOne(query, update);
      res.send(result);
    });

    app.delete("/reviews/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const reviewQuery = { _id: new ObjectId(id) };
      const favReviewQuery = { reviewId: id };
      const deleteReviewResult = await reviewCollection.deleteOne(reviewQuery);
      const deleteFavReviewResult = await favoriteReviewsCollection.deleteOne(
        favReviewQuery
      );
      res.send({
        reviewDeleteInfo: deleteReviewResult,
        favReviewDeleteInfo: deleteFavReviewResult,
      });
    });

    // Favorite Review APi's

    app.post("/favorite-reviews", verifyFirebaseToken, async (req, res) => {
      const newFavoriteReview = req.body;
      const { userEmail, reviewId } = newFavoriteReview;
      const exist = await favoriteReviewsCollection.findOne({
        reviewId,
        userEmail,
      });
      if (exist) {
        return res.status(409).send({ message: "Already in favorites." });
      }
      newFavoriteReview.add_date = new Date();
      const result = favoriteReviewsCollection.insertOne(newFavoriteReview);
      res.send(result);
    });

    app.get("/my-favorite-reviews", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.userEmail = email;
      }
      const cursor = favoriteReviewsCollection
        .find(query)
        .sort({ add_date: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.delete(
      "/favorite-reviews/:id",
      verifyFirebaseToken,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await favoriteReviewsCollection.deleteOne(query);
        res.send(result);
      }
    );

    //! ADMIN Aggregations & API"S

    app.get(
      "/admin/all-reviews",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const result = await reviewCollection
          .find()
          .sort({ postedDate: -1 })
          .toArray();
        res.send(result);
      }
    );

    app.patch(
      "/admin/reviews/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const updateReview = req.body;
        const query = { _id: new ObjectId(id) };
        const update = { $set: updateReview };
        const result = await reviewCollection.updateOne(query, update);
        res.send(result);
      }
    );

    app.delete(
      "/reviews/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        // The original review to be deleted
        const reviewQuery = { _id: new ObjectId(id) };
        const deleteReviewResult = await reviewCollection.deleteOne(
          reviewQuery
        );

        // Also delete any favorites associated with this reviewId
        const favReviewQuery = { reviewId: id };
        const deleteFavReviewResult =
          await favoriteReviewsCollection.deleteMany(favReviewQuery); // Use deleteMany in case multiple users favorited it

        res.send({
          reviewDeleteInfo: deleteReviewResult,
          favReviewDeleteInfo: deleteFavReviewResult,
        });
      }
    );

    app.get(
      "/admin-stats",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const userCount = await usersCollection.countDocuments();
          const reviewCount = await reviewCollection.countDocuments();
          const favoriteCount =
            await favoriteReviewsCollection.countDocuments();

          // Aggregation for monthly reviews
          const monthlyReviews = await reviewCollection
            .aggregate([
              {
                $group: {
                  _id: {
                    year: { $year: "$postedDate" },
                    month: { $month: "$postedDate" },
                  },
                  count: { $sum: 1 },
                },
              },
              { $sort: { "_id.year": 1, "_id.month": 1 } },
              {
                $project: {
                  _id: 0,
                  month: {
                    $concat: [
                      { $toString: "$_id.year" },
                      "-",
                      { $toString: "$_id.month" },
                    ],
                  },
                  count: 1,
                },
              },
            ])
            .toArray();

          // Aggregation for review distribution by rating
          const ratingDistribution = await reviewCollection
            .aggregate([
              { $group: { _id: "$rating", count: { $sum: 1 } } },
              { $sort: { _id: 1 } },
              {
                $project: {
                  _id: 0,
                  name: { $concat: [{ $toString: "$_id" }, " Star"] },
                  value: "$count",
                },
              },
            ])
            .toArray();

          res.send({
            userCount,
            reviewCount,
            favoriteCount,
            monthlyReviews,
            ratingDistribution,
          });
        } catch (error) {
          res.status(500).send({ message: "Failed to fetch admin stats." });
        }
      }
    );

    app.get("/user-stats", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      if (req.token_email !== email)
        return res.status(403).send({ message: "Forbidden access." });

      try {
        const reviewCount = await reviewCollection.countDocuments({
          reviewerEmail: email,
        });
        const favoriteCount = await favoriteReviewsCollection.countDocuments({
          userEmail: email,
        });
        const recentReviews = await reviewCollection
          .find({ reviewerEmail: email })
          .sort({ postedDate: -1 })
          .limit(3)
          .toArray();

        // Aggregation for the user's personal rating distribution
        const userRatingDistribution = await reviewCollection
          .aggregate([
            { $match: { reviewerEmail: email } },
            { $group: { _id: "$rating", count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                name: { $concat: [{ $toString: "$_id" }, " Star"] },
                value: "$count",
              },
            },
          ])
          .toArray();

        res.send({
          reviewCount,
          favoriteCount,
          recentReviews,
          userRatingDistribution,
        });
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch user stats." });
      }
    });

    //? PAYMENT API"s
    app.post(
      "/create-payment-intent",
      verifyFirebaseToken,
      async (req, res) => {
        const { packageName } = req.body;

        const prices = {
          taster: 499,
          foodie: 999,
          gourmet: 1999,
        };

        const amount = prices[packageName?.toLowerCase()];
        if (!amount) {
          return res.status(400).send({ message: "Invalid Package Selected" });
        }

        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            payment_method_types: ["card"],
            metadata: {
              user_email: req.token_email,
              package: packageName,
            },
          });

          res.send({
            clientSecret: paymentIntent.client_secret,
          });
        } catch (error) {
          console.error(error);
          res.status(500).send({ message: "Failed to create payment intent." });
        }
      }
    );

    // user's role AFTER payment
    app.patch("/users/make-premium", verifyFirebaseToken, async (req, res) => {
      const email = req.token_email;
      const { package: packageName } = req.body; // Receive package name from frontend

      const filter = { email: email };
      const updatedDoc = {
        $set: {
          role: "premium",
          package: packageName || "Premium", // Store specific package (e.g., "Gourmet")
        },
      };

      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running from ${port}`);
});
