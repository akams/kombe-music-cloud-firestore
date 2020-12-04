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

const INDEX_NAME = 'dev_TRACK_SEARCH';
const POCK_INDEX_NAME = 'dev_ZOO_SEARCH';

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
    const index = client.initIndex(POCK_INDEX_NAME);

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

    const client = algoliasearch(APP_ID, ADMIN_KEY);
    const index = client.initIndex(POCK_INDEX_NAME);

    return index.deleteObject(objectID)
  });

exports.algoliaRequest = functions.https.onRequest(main);

app.post('/import-collection-music-to-algolia', async (request, response) => {
  try {
    const db = admin.firestore();
    const snapshotMusic = await db.collection('music').orderBy('uploadAt', 'desc').get();
    const snapshotAlbum = await db.collection('albums').get();
    
    const recordsMusic = [];
    snapshotMusic.forEach((doc) => {
      recordsMusic.push({
        objectID: doc.id,
        ...doc.data(),
      });
    });

    const recordsAlbums = [];
    snapshotAlbum.forEach((doc) => {
      recordsAlbums.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    const records = recordsMusic.map((music) => {
      const album = recordsAlbums.map((album) => {
        if (music.album === album.id) {
          return {
            albumName: album.name,
          }
        }
        return undefined;
      }).filter((v) => typeof v !== "undefined");
      return {
        ...music,
        ...album[0],
      }
    }).map((clean) => {
      return {
        objectID: clean.objectID,
        name: clean.name,
        fileName: clean.fileName,
        author: clean.author,
        tags: clean.tags,
        albumName: clean.albumName,
        uploadAt: clean.uploadAt,
      }
    })

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
