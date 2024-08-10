const express = require('express')
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
    const parcelCollection = client.db('parcelDB').collection('parcels');
    const paymentCollection = client.db('parcelDB').collection('payments');
    const feedbackCollection = client.db('parcelDB').collection('feedback');

    // my delivery list
    app.get('/myDeliveryList',async(req, res)=>{
      const email = req.query?.email;
      const query = {email:email}
      const user = await userCollection.findOne(query);
      const deliveryMenId = user._id.toString();
      const filter = { deliveryMenId: deliveryMenId };
      const result = await parcelCollection.find(filter).toArray();
      console.log(result)
      res.send(result);     
    })

    // parcels related api
    app.get('/bookParcel',async(req,res)=>{
      const email = req.query?.email;
      if(email){
        // console.log(email);
        const query = {email:email};
        const result = await parcelCollection.find(query).toArray();
        // console.log(result);
        res.send(result);
      }
      else{
        const result = await parcelCollection.find().toArray();
        res.send(result)
      }     
    })

    app.get('/bookParcel/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await parcelCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/bookParcel',async(req, res)=>{
      const parcel = req.body;
      const result = await parcelCollection.insertOne(parcel)
      res.send(result)
      
    })
    // update status for parcel cancel
    app.patch('/bookParcel/cancel',async(req, res)=>{
      const { parcelId, status } = req.body;
      // console.log(typeof parcelId);
      const filter = {_id: new ObjectId(parcelId)};
      const option = { upsert: true};
      const updatedDoc ={
        $set:{
          status: status
        }
      }
      const result = await parcelCollection.updateOne(filter,updatedDoc, option)
      console.log('cancelled', result);
      res.send(result);
    })

    // update booked parcel
    app.patch('/bookParcel/update',async(req, res)=>{
      const bookedParcelId = req.body.bookedParcelId;
      const updatedData = req.body;
      const filter = {_id: new ObjectId(bookedParcelId)}
      const option = { upsert: true }
      const updatedDoc ={
        $set:{
          name:updatedData.name,
          email:updatedData.email,
          phone:updatedData.phone,
          parcelType:updatedData.parcelType,
          parcelWeight:updatedData.parcelWeight,
          receiverName:updatedData.receiverName,
          receiverPhoneNumber:updatedData.receiverPhoneNumber,
          receiverAddress:updatedData.receiverAddress,
          requestedDeliveryDate:updatedData.requestedDeliveryDate,
          latitude:updatedData.latitude,
          longitude:updatedData.longitude,
          price:updatedData.price,
          bookingDate:updatedData.bookingDate,
          status:updatedData.status
        }
      }
      const result = await parcelCollection.updateOne(filter, updatedDoc,option)
      console.log(result)
      res.send(result)
    })

    // delivery men assign
    app.patch('/assignDeliveryMen',async(req, res)=>{
      const parcelId = req.body.parcelId;
      const updatedData = req.body;
      const filter = {_id: new ObjectId(parcelId)}
      const option = { upsert: true }
      const updatedDoc ={
        $set:{
          deliveryMenId:updatedData.deliveryMenId,
          approximateDeliveryDate:updatedData.approximateDeliveryDate,
          status:'On the way'
        }
      }
      const result = await parcelCollection.updateOne(filter, updatedDoc,option)
      console.log(result)
      res.send(result)
    })

    // deliverymen get
    app.get('/deliveryMen', async(req,res)=>{
      const status ='deliveryMen';
      const query = {role:status};
      const result = await userCollection.find(query).toArray();
      res.send(result);
    })

    // PAYMENT RELATED API
    app.post('/create-payment-intent',async(req, res)=>{
      const { price } = req.body;
      console.log(price)
      const amount = parseInt(price*100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount:amount,
        currency:'usd',
        payment_method_types:['card']
      });
      
      res.send({clientSecret: paymentIntent.client_secret})
    })

    app.post('/payments',async(req, res)=>{
      const payment = req.body;
      console.log('payment:',payment)
      const paymentResult = await paymentCollection.insertOne(payment)
      res.send(paymentResult)
    })

    // feedback related api
    app.post('/feedback', async(req,res)=>{
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result);
    })
    
    
    // users related api
    app.get('/users',async(req,res)=>{
        // const email = req.query?.email;
        // console.log(id)
        // if(email){
        //   const query ={email:email}
        //   const result = await userCollection.find(query).toArray();
        //   res.send(result);
        // }
        // else{
          const result = await userCollection.find().toArray();
          res.send(result);
        // }
    })
    
    app.get('/deliveryMen',async(req,res)=>{
        const query ={role: 'deliveryMen'}
        const result = await userCollection.find(query).toArray();
        // console.log(result)
        res.send(result);
    })
    app.post('/users', async(req, res)=>{
        const user = req.body;
        // console.log(user)
        const query = { email: user.email }
        const existingUser = await userCollection.findOne(query);
        if(existingUser){
            return res.send({message:'user already exists', insertedId:null})
        }
        const result = await userCollection.insertOne(user);
        res.send(result)
    })
    app.patch('/users', async(req,res)=>{
      const {id, role} = req.body;
      const filter ={_id: new ObjectId(id)};
      const updatedDoc={
        $set:{
          role:role
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
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