const express = require('express')
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());


const uri = "mongodb+srv://parcel:GFHMwsPs7bdndJTk@cluster0.yk1xelo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db('parcelDB').collection('users');

    // users related api
    app.post('/users', async(req, res)=>{
        const user = req.body;
        const query = { email: user.email }
        const existingUser = await userCollection.findOne(query);
        if(existingUser){
            return res.send({message:'user already exists', insertedId:null})
        }
        const result = await userCollection.insertOne(user);
        res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/',(req,res)=>{
    res.send('parcel management project is running')
})
app.listen(port, ()=>{
    console.log(`Parcel management project is running ${port}`)
})