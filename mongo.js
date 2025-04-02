const { MongoClient } = require("mongodb");

const uri = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.4.2";
const client = new MongoClient(uri);

let db;

async function connectDB() {
    if (!db) {  // Ensure we connect only once
        await client.connect();
        console.log("Connected to MongoDB");
        db = client.db("Lan_Chat"); // Assign the database
       
    }
    return db;
}

module.exports = { connectDB };
