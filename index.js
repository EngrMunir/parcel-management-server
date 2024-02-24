const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port =process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@food.rfdgglw.mongodb.net/?retryWrites=true&w=majority`;

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

    const userCollection = client.db("parcelDb").collection("users");
    const parcelCollection = client.db("parcelDb").collection("parcels");

    // jwt related api

    app.post('/jwt', async(req,res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24hr'});
      res.send({ token });
    })


    // middlewares
    const verifyToken =(req, res, next)=>{
      // console.log('inside verify token',req.headers);
      if(!req.headers.authorization){

        return res.status(401).send({ message: 'forbidden access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
          return res.status(401).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
        next();
      })
      
    }

    const verifyAdmin = async(req, res, next) =>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'});
      }
      next();
    }

    // users related api
    app.get('/users', verifyToken, verifyAdmin, async(req, res)=>{
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    // sending particular user info
    app.get('/users/:email', async(req, res)=>{
      const email = req.params.email;
      const query = {email: email};
      const result = await userCollection.find(query).toArray();
      res.send(result);
    })
    
    app.get('/users/admin/:email',verifyToken, async(req, res)=>{
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'unauthorized access'})
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role ==='admin';
      }
      res.send({admin});
    })

    // get delivery men api
    // check particular user isDeliveryMen or not
    app.get('/users/deliveryMen/:email', async(req, res)=>{
      const email = req.params.email;
      const query = { email:email, role: 'deliveryMen'}
      const user = await userCollection.findOne(query);
      if(user){
        res.send({isDeliveryMen: true})
        console.log(user.role)
      }
      else{
        res.send({isDeliveryMen: false})
      }
    })

    // get all delivery men data
    app.get('/users/deliveryMen', async (req, res) => {
      try {
        const query = { role: 'deliveryMen' };
        const user = await userCollection.find(query).toArray();
        // console.log('get hitted from client');
    
        if (user) {
          res.send(user.length > 0);
          console.log('delivery men all ', user);
        } else {
          res.status(404).send("No delivery men found");
        }
      } catch (error) {
        console.error('Error fetching delivery men:', error);
        res.status(500).send("Internal Server Error");
      }
    });
    
    
    app.get('/parcels/:email', async(req, res)=>{
      const email = req.params.email;
      const query = {email: email};
      const result = await parcelCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/parcels/update/:id', async(req, res) =>{
      const id = req.params.id;
      console.log('received id ',id);
      const query ={ _id: new ObjectId(id) }
      const result = await parcelCollection.findOne(query);
      console.log(' update parcel result  ',result)
      res.send(result);
    })

     app.get('/parcels', async(req, res)=>{
      const result = await parcelCollection.find().toArray();
      res.send(result);
    })


    app.post('/parcels',async(req, res)=>{
      const newParcels = req.body;
      const result = await parcelCollection.insertOne(newParcels);
      res.send(result);
    })
    
    app.post('/users', async(req,res)=>{
      const user = req.body;

      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({ message: 'user already exists', insertedId: null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    app.delete('/users/:id', async(req, res)=>{
      const id= req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })
    // payment intent
    app.post('/create-payment-intent', async(req, res)=>{
      const { price } = req.body;
      const amount = parseInt(price*100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_type:['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // particular field update to make admin
    app.patch('/users/admin/:id',verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const updatedDoc = {
        $set:{
          role:'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result); 
    })

    // make deliveryMen
    app.patch('/users/deliveryMen/:id',verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const updatedDoc = {
        $set:{
          role:'deliveryMen'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result); 
    })

    app.delete('/users/:id',verifyToken, verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userCollection.deleteOne(query);
      res.send(result);
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


app.get('/',(req, res) =>{
    res.send('Parcel is running')
})
app.listen(port, ()=>{
    console.log(`Parcel running on port ${port}`);
})