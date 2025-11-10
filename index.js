require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
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
      newReview.postedDate = new Date().toISOString();
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
    });

    app.get("/all-reviews", async (req, res) => {
      const cursor = reviewCollection.find().sort({ postedDate: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/featured-products", async (req, res) => {
      const cursor = reviewCollection
        .find()
        .sort({ rating: -1 }, { postedDate: -1 })
        .limit(6);
      const result = await cursor.toArray();
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
