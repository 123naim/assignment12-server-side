const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config()
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
        await client.connect();
        const userCollection = client.db("forumDb").collection('users');
        const postCollection = client.db("forumDb").collection('posts');




        // user related api start
        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user doesnt exists:
            // you can do this many ways (1. email unique, 2. upsert, 3. simple cheking)
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ massage: 'user alreedy axists', insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })
        // User Related Api End



        // Post Related Api Start
        app.get('/post', async (req, res) => {
            const result = await postCollection.find().toArray();
            res.send(result)
        })
        app.get('/post/:id', async (req, res) => {
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
        })
        // Post Related Api End


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



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
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