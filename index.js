const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8ffvdrk.mongodb.net/?retryWrites=true&w=majority`;

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
        // await client.connect();
        const userCollection = client.db("forumDb").collection('users');
        const postCollection = client.db("forumDb").collection('posts');
        const announcementCollection = client.db("forumDb").collection('announcement');


        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // middlewares
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ massage: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ massage: 'unauthorized access' });
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ massage: 'forbidden access' });
            }
            next();
        }



        // user related api start
        app.get('/users', verifyToken, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })
        app.get('/signleData/:email',  async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result)

        })
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ massage: 'forbidden access' })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user.role === 'admin';
            }
            res.send({ admin })
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ massage: 'user alreedy axists', insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        });
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })
        // User Related Api End



        // Post Related Api Start
        app.get('/post', async (req, res) => {
            const result = await postCollection.find().toArray();
            res.send(result)
        })
        app.get('/mypost', async (req, res) => {
            const email = req.query.email;
            const query = { authorEmail: email };
            const result = await postCollection.find(query).toArray();
            res.send(result)
        })
        app.get('/post/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await postCollection.findOne(query)
            res.send(result)
        })
        app.post('/post', async (req, res) => {
            const item = req.body;
            const result = await postCollection.insertOne(item);
            res.send(result)
        })
        app.patch('/post/:id', async (req, res) => {
            const id = req.params.id;
            const user = req.body;
            const query = { _id: new ObjectId(id) };
            const option = { upsert: true };
            const updatedUser = {
                $set: {
                    upVote: user.upVote,
                    downVote: user.downVote
                }
            }
            const result = await postCollection.updateOne(query, updatedUser, option);
            res.send(result)
        });
        app.delete('/post/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await postCollection.deleteOne(query);
            res.send(result)
        })
        // Post Related Api End

        // Announcement Related API start
        app.get('/announcement', async(req, res) => {
            const result = await announcementCollection.find().toArray();
            res.send(result)
        })
        app.post('/announcement', verifyToken, verifyAdmin, async(req, res) => {
            const announcement = req.body;
            const result = await announcementCollection.insertOne(announcement)
            res.send(result);
        })


        // Vote Related API Start
        app.get('/user-vote-status/:id', async (req, res) => {
            try {
                const postId = req.params.id;
                const post = await Post.findById(postId);
                if (!post) {
                    return res.status(404).json({ message: 'Post not found' });
                }
                res.json(post);
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
        app.post('record-user-vote/:id', async (req, res) => {
            try {
                const postId = req.params.id;
                const userId = req.user.id; // Assuming you have user authentication middleware

                // Check if the user has already voted
                const existingVote = await UserVotes.findOne({ userId, postId });

                if (!existingVote) {
                    // Record the user's vote status
                    await UserVotes.create({ userId, postId, hasVoted: true });
                    res.json({ message: 'User vote status recorded successfully' });
                } else {
                    res.status(400).json({ message: 'User has already voted for this post' });
                }
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
        app.patch('record-user-vote/:id', async (req, res) => {
            try {
                const postId = req.params.id;
                const { upVote, downVote } = req.body;

                const updatedPost = await Post.findByIdAndUpdate(
                    postId,
                    { upVote, downVote },
                    { new: true } // Return the updated document
                );

                if (!updatedPost) {
                    return res.status(404).json({ message: 'Post not found' });
                }

                res.json({ modifiedCount: 1 }); // Indicate that the post was successfully updated
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Internal server error' });
            }
        });
        // Vote Related API End

        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });
        app.patch('/users/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            console.log(filter)
            const updatedDoc = {
                $set: {
                    badge: 'Gold Badge'
                }
            };
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })




        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('hello assignment')
})
app.listen(port, () => {
    console.log(`Assignment 12 testing purpose running now ${port}`)
})