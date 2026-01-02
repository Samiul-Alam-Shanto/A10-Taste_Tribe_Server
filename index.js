require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");

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

const verifyAdmin = async (req, res, next) => {
  const email = req.token_email;

  const query = { email: email };
  const user = await usersCollection.findOne(query);

  if (user?.role !== "admin") {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
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

    // DELETE a user (admin)
    app.delete(
      "/users/:id",
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
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
      let query = {};
      if (req.query.search) {
        query = { foodName: { $regex: req.query.search, $options: "i" } };
      }
      const cursor = reviewCollection.find(query).sort({ postedDate: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/featured-reviews", async (req, res) => {
      const cursor = reviewCollection.find().sort({ rating: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/reviews/:id", verifyFirebaseToken, async (req, res) => {
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
