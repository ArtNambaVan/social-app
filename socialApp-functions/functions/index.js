const functions = require('firebase-functions');
const admin = require('firebase-admin');
var serviceAccount = require("./socialape-74003-firebase-adminsdk-anr9k-f617b24ee1.json");
const express = require('express');
const app = express();
const firebase = require('firebase');
var firebaseConfig = {
    apiKey: "AIzaSyC3MT2yKyIfWq-RcK2ZLRFFBl-6RDjlkHM",
    authDomain: "socialape-74003.firebaseapp.com",
    databaseURL: "https://socialape-74003.firebaseio.com",
    projectId: "socialape-74003",
    storageBucket: "socialape-74003.appspot.com",
    messagingSenderId: "540432941576",
    appId: "1:540432941576:web:73310886a41426980d87bd",
    measurementId: "G-EPDHBFS2Z6"
};
firebase.initializeApp(firebaseConfig)

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://socialape-74003.firebaseio.com"
});

const db = admin.firestore();


app.get('/screams', (req, res) => {
    db
    .collection('screams')
    .orderBy('createdAt', 'desc')
    .get()
    .then( data => {
        const screams = [];
        data.forEach( doc => screams.push({
            screamId: doc.id,
            body: doc.data().body,
            userHandle: doc.data().userHandle,
            createdAt: doc.data().createdAt
        }));
        return res.json(screams)
    })
    .catch( err => console.log(err) )
})

const FBAuth = (req, res, next) => {
    let idToken
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('No token found')
        return res.status(403).json({ error: 'Unauthorized' })
    }
    console.log(idToken)

    admin.auth().verifyIdToken(idToken)
        .then(decodedToken => {
            req.user = decodedToken;
            console.log(decodedToken)
            return db.collection('users')
                .where('userId', '==', req.user.userId)
                .limit(1)
                .get()
        })
        .then(data => { 
            req.user.handle = data.docs[0].data().handle;
            return next();
        })
        .catch(err => {
            console.error('Error while verifying token ', err);
            return res.status(400).json({ body: 'Body must not be empty' })
        })
}

app.post('/scream', FBAuth, (req, res) => {
    const newScream = {
        body: req.body.body,
        userHandle: req.body.userHandle,
        createdAt: new Date().toISOString()
    }

    db
        .collection('screams')
        .add(newScream)
        .then(doc => {
            res.json({ message: `document ${doc.id} created successfully` });
        })
        .catch(err => {
            res.status(500).json({ error: 'something went wrong' });
            console.log(err)
        })
})

const isEmail = (email) => {
    const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (email.match(regEx)) return true;
    return false
}

const isEmpty = string => {
    if (string.trim() === '') return true
    return false
}

// Signup route
app.post('/signup', (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle,
    }

    const errors = {};

    if(isEmpty(newUser.email)) {
        errors.email = 'Must not be empty';
    } else if (!isEmail(newUser.email)) {
        errors.email = 'Must be a valid email address'
    }

    if(isEmpty(newUser.password)) errors.password = 'Must not be empty';
    if (newUser.password !== newUser.confirmPassword) errors.confirmPassword = "Password must match";
    if(isEmpty(newUser.handle)) errors.handle = 'Must not be empty';

    if(Object.keys(errors).length > 0) return res.status(400).json(errors); 

    //TODO: validate data
    let token, userId;

    db.doc(`/users/${newUser.handle}`).get()
        .then( doc => {
            if (doc.exists) {
                return res.status(400).json({ handle: 'this handle is alredy taken' })
            } else {
                return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
            }
        })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken()
        })
        .then(idToken => {
            token = idToken;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId
            };
            return db.doc(`/users/${newUser.handle}`).set(userCredentials);
        })
        .then( () => {
            return res.status(201).json({ token });
        })
        .catch(err => {
            console.error(err);
            if (err.code === "auth/email-already-in-use") {
                return res.status(400).json({ email: 'Email is already is use ' })
            }
            return res.status(500).json({ error: err.code })
        })
})

app.post('/login', (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    let errors = {}

    if (isEmpty(user.email)) errors.email = "Must not be empty";
    if (isEmpty(user.password)) errors.password = "Must not be empty";

    if (Object.keys(errors).length > 0) return res.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
        .then( data => {
            return data.user.getIdToken();
        })
        .then( token => {
            return res.json({ token });
        })
        .catch(err => {
            console.error(err);
            if (err.code === "auth/wrong-password") {
                return res.status(403).json({ general: 'Wrong credentials, please try again' })
            }
            return res.status(500).json({ error: err.code });
        })
})

exports.api = functions.region('europe-west1').https.onRequest(app);