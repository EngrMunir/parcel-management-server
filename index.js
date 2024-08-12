const express = require('express')
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
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

    // jwt related api
    app.post('/jwt',async(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1hr'});
      res.send({ token });
    })

    // middleware
    const verifyToken = (req,res, next)=>{
      console.log('inside verify token',req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message:'forbidden access'})
      }
      const token = req.headers.authorization.split(' ')[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
        if(err){
          return res.status(401).send({message: 'forbidden access'})
        }
        req.decoded =decoded;
        next();
      })
    }
    // my delivery list
    app.get('/myDeliveryList',async(req, res)=>{
      const email = req.query?.email;
      const query = {email:email}
      const user = await userCollection.findOne(query);
      const deliveryMenId = user._id.toString();
      const filter = { deliveryMenId: deliveryMenId };
      const result = await parcelCollection.find(filter).toArray();
      // console.log(result)
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
      // console.log('cancelled', result);
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
      // console.log(result)
      res.send(result)
    })

    // delivery men assign
    app.patch('/assignDeliveryMen',async(req, res)=>{
      const parcelId = req.body.parcelId;
      const updatedData = req.body;
      console.log('updated assign info',updatedData);
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
      // console.log(result)
      res.send(result)
    })

    // deliverymen get
    app.get('/allDeliveryMen', async(req,res)=>{
      const deliveryMen = await userCollection.find({role:'deliveryMen'}).toArray();
      res.send(deliveryMen);
    })
    app.get('/deliveryMen', async(req,res)=>{
      // get all deliveryMen
      const deliveryMen = await userCollection.find({role:'deliveryMen'}).toArray();
      // console.log(deliveryMen)

      // map through each deliveryMen to gather total parcel and average parcel
      const deliveryMenStats = await Promise.all(deliveryMen.map(async (deliveryMen)=>{
        const deliveryMenId = deliveryMen._id.toString();
        const parcelCount = await parcelCollection.countDocuments({deliveryMenId});
        const reviews = await feedbackCollection.find({deliveryMenId}).toArray();
        const averageReview = reviews.length> 0 
        ? reviews.reduce((sum, review)=>sum+review.rating,0)/reviews.length:0;

        return{
          name: deliveryMen.name,
          phoneNumber: deliveryMen.phoneNumber,
          parcelCount,
          averageReview
        };
      }));
      res.send(deliveryMenStats);
    })

    app.get('/topDeliveryMen', async (req, res) => {
          const deliveryMen = await userCollection.aggregate([
              {
                  $match: { role: 'deliveryMen' } // Filter only delivery men
              },
              {
                  $lookup: {
                      from: 'parcels',
                      localField: '_id',
                      foreignField: 'deliveryMenId',
                      as: 'parcels'
                  }
              },
              {
                  $lookup: {
                      from: 'feedback',
                      localField: '_id',
                      foreignField: 'deliveryMenId',
                      as: 'reviews'
                  }
              },
              {
                  $addFields: {
                      parcelCount: { $size: "$parcels" }, // Count the number of parcels
                      averageRating: {
                          $cond: {
                              if: { $eq: [{ $size: "$reviews" }, 0] },
                              then: 0,
                              else: { $avg: "$reviews.rating" } // Average the ratings
                          }
                      }
                  }
              },
              {
                  $sort: {
                      parcelCount: -1,       // Sort by number of parcels delivered (descending)
                      averageRating: -1      // Then sort by average rating (descending)
                  }
              },
              {
                  $limit: 3 // Limit to top 3 delivery men
              },
              {
                  $project: {
                      name: 1,
                      image: 1,
                      parcelCount: 1,
                      averageRating: 1
                  }
              }
          ]).toArray();
          console.log(deliveryMen);
          res.send(deliveryMen);
  });
  
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
    app.get('/feedback',async(req,res)=>{
      const email = req.query.email;
      // console.log(email)
      const query = {email: email}
      const user = await userCollection.findOne(query);
      // console.log(user)
      const id = user._id.toString();
      // console.log('id',id)
      const filter = { deliveryMenId:id}
      const result = await feedbackCollection.find(filter).toArray();
      res.send(result);
    })
    app.post('/feedback', async(req,res)=>{
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result);
    })
    
    
    // users related api
    app.get('/users',async(req,res)=>{
        const email = req.query?.email;
        if(email){
          const query ={email:email}
          const result = await userCollection.find(query).toArray();
          res.send(result);
        }
        else{
          const result = await userCollection.find().toArray();
          res.send(result);
        }
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