require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
    await client.connect();
    const db = client.db("taste_tribe_DB");
    const reviewCollection = db.collection("reviews");

    // review api's

    app.post("/reviews", async (req, res) => {
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

    app.get("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.findOne(query);
      res.send(result);
    });

    app.get("/my-reviews", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.reviewerEmail = email;
      }
      const cursor = reviewCollection.find(query).sort({ postedDate: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`server is running from ${port}`);
});
