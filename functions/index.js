/* eslint-disable handle-callback-err */
/* eslint-disable promise/catch-or-return */
/* eslint-disable promise/always-return */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const algoliasearch = require('algoliasearch');

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')();
const cors = require('cors')({origin: true});

const app = express(); // Handle intern API
const main = express(); // Expose API

admin.initializeApp(functions.config().firebase);

main.use(cors);
main.use(cookieParser);
main.use('/api/v1', app);
main.use(bodyParser.json());

const env = functions.config();

const APP_ID = env.algolia.appid;
const ADMIN_KEY = env.algolia.apikey;
const INDEX_NAME = 'dev_ZOO_SEARCH';

exports.indexAnimal = functions.firestore
  .document('zoo/{animalId}')
  .onCreate((snap) => {
    console.log('onCreate');

    const data = snap.data();
    const objectID = snap.id;

    const record = {
      objectID,
      ...data,
    };

    console.log('record to imported into Algolia', record);

    const client = algoliasearch(APP_ID, ADMIN_KEY);
    const index = client.initIndex(INDEX_NAME);

    index
    .saveObject(record)
    .then(() => {
      console.log('record imported into Algolia');
    })
    .catch(error => {
      console.error('Error when importing contact into Algolia', error);
      process.exit(1);
    });
  });

exports.unindexAnimal = functions.firestore
  .document('zoo/{animalId}')
  .onDelete((snap) => {
    console.log('onDelete');
    const objectID = snap.id;
    console.log('record to delete into Algolia', objectID);
    return index.deleteObject(objectID)
  });

exports.algoliaRequest = functions.https.onRequest(main);

app.get('/warmup', async (request, response) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('zoo').get();
    
    const records = [];
    snapshot.forEach((doc) => {
      records.push({
        objectID: doc.id,
        ...doc.data(),
      });
    });

    const client = algoliasearch(APP_ID, ADMIN_KEY);
    const index = client.initIndex(INDEX_NAME);

    index
      .saveObjects(records)
      .then((contents) => {
        console.log('records imported into Algolia');
        return response.json(contents);
      })
      .catch(error => {
        console.error('Error when importing contact into Algolia', error);
        process.exit(1);
      });
  } catch (error) {
    response.status(500).send({ err: error.message });
  }
})