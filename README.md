<div align="center">

  <img src="https://cdn-icons-png.flaticon.com/512/706/706164.png" alt="TasteTribe Logo" width="120" />

  # 🍽️ TasteTribe Server API
  ### The Secure Backend Infrastructure for TasteTribe

  <p align="center">
    <b>Secure Token Verification</b> • <b>MongoDB Aggregations</b> • <b>Cascade Data Management</b>
  </p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/Node.js-v18-339933?style=for-the-badge&logo=node.js&logoColor=white" />
    <img src="https://img.shields.io/badge/Express-v4-000000?style=for-the-badge&logo=express&logoColor=white" />
    <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
    <img src="https://img.shields.io/badge/Firebase_Admin-SDK-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
  </p>

  <!-- Quick Links -->
  <p>
    <a href="https://taste-tribe-server-rouge.vercel.app/"><strong>🔗 Base API URL</strong></a>
    &nbsp;&nbsp;•&nbsp;&nbsp;
    <a href="https://github.com/Samiul-Alam-Shanto/A10-Taste_Tribe_Client.git"><strong>💻 Client Repository</strong></a>
  </p>

</div>

---

## 🚀 System Architecture

This repository hosts the **RESTful API** powering TasteTribe. Unlike simple backends, this server implements **Server-Side Security** using the Firebase Admin SDK to verify identity tokens before allowing data modification.

It connects to a **MongoDB Atlas** cluster to handle complex data relationships, including specific user queries, search indexing, and data integrity operations.

---

## ⚡ Key Backend Capabilities

| Feature | Description |
| :--- | :--- |
| **🔐 Middleware Security** | Custom `verifyFirebaseToken` middleware intercepts requests to ensure only authenticated users access private routes. |
| **🔍 Regex Search** | Implements MongoDB `$regex` with the `$options: "i"` flag for seamless, case-insensitive searching of food items. |
| **⛓️ Cascade Deletion** | **Data Integrity Protocol:** When a review is deleted, the server automatically purges it from all users' "Favorites" lists in a single transaction. |
| **📅 Sorting & Limiting** | Optimized endpoints to fetch "Featured Reviews" (Top 6 by Rating) and chronological sorting. |
| **🚫 Duplicate Prevention** | Prevents users from adding the same review to their favorites list multiple times. |

---

## 📡 API Documentation

### 🍔 Review Management
| Method | Endpoint | Protected | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/reviews` | 🔒 Yes | Create a new review. Auto-stamps `postedDate`. |
| `GET` | `/all-reviews` | 🔓 No | Fetch all reviews. Supports query `?search=pizza`. |
| `GET` | `/featured-reviews` | 🔓 No | Returns top 6 highest-rated reviews. |
| `GET` | `/reviews/:id` | 🔒 Yes | Fetch details of a specific review. |
| `GET` | `/my-reviews` | 🔒 Yes | Fetch reviews by user. Requires `?email=user@mail.com`. |
| `PATCH` | `/reviews/:id` | 🔒 Yes | Update review details (Rating, Text, etc). |
| `DELETE` | `/reviews/:id` | 🔒 Yes | **Hard Delete:** Removes review & removes it from all favorites. |

### ❤️ Favorites & Watchlist
| Method | Endpoint | Protected | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/favorite-reviews` | 🔒 Yes | Add review to favorites. Checks for duplicates. |
| `GET` | `/my-favorite-reviews` | 🔒 Yes | Get user's watchlist. Requires `?email=...`. |
| `DELETE` | `/favorite-reviews/:id` | 🔒 Yes | Remove an item from the favorites list. |

---

## 🛠 Tech Stack

*   **Runtime:** `Node.js`
*   **Framework:** `Express.js`
*   **Database:** `MongoDB` (Native Driver)
*   **Authentication:** `Firebase Admin SDK`
*   **Security:** `CORS`, `Dotenv`

---

## 💻 Local Installation Guide

Since this server uses **Firebase Admin SDK**, you need a service account key to run it locally.

### 1. Clone & Install
```bash
git clone https://github.com/Samiul-Alam-Shanto/A10-Taste_Tribe_Server.git
cd A10-Taste_Tribe_Server
npm install
```
### 2. Setup Environment Variables
Create a .env file:
```bash
PORT=3000
DB_USER=your_mongo_username
DB_PASSWORD=your_mongo_password
```
### 3. Setup Firebase Admin Key
1. Go to Firebase Console > Project Settings > Service Accounts.
2. Click Generate New Private Key.
3. Rename the downloaded file to firebase_SDK.json.
4. Place this file in the root directory of the project.
⚠️ Note: Never push firebase_SDK.json to GitHub.

### 4. Start Sever
```bash
npm start
```
Server will run at http://localhost:3000.

## 👨‍💻 Author
Samiul Alam Shanto
MERN Stack Developer
<div align="left">
<a href="mailto:samiulalam220@gmail.com">
<img src="https://img.shields.io/badge/Gmail-Contact_Me-red?style=flat-square&logo=gmail" alt="Email" />
</a>
<a href="https://github.com/Samiul-Alam-Shanto">
<img src="https://img.shields.io/badge/GitHub-Profile-181717?style=flat-square&logo=github" alt="GitHub" />
</a>
</div>
<p align="center">
© 2025 TasteTribe Server.
</p>
