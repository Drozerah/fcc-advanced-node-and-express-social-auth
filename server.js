'use strict'
require('dotenv').config()
const express     = require('express')
const bodyParser  = require('body-parser')
const fccTesting  = require('./freeCodeCamp/fcctesting.js')
const session     = require('express-session')
const mongo       = require('mongodb').MongoClient
const passport    = require('passport')
const GitHubStrategy = require('passport-github').Strategy

const app = express()

fccTesting(app) //For FCC testing purposes

app.use('/public', express.static(process.cwd() + '/public'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.set('view engine', 'pug')
// MongoDB client options
const mongodbOptions = { useUnifiedTopology: true }
mongo.connect(process.env.DATABASE, mongodbOptions, (err, connection) => {
    if(err) {
        console.log('Database error: ' + err)
    } else {
        console.log('Successful database connection')
        const db = connection.db()
        app.use(session({
          secret: process.env.SESSION_SECRET,
          resave: true,
          saveUninitialized: true,
        }))
        app.use(passport.initialize())
        app.use(passport.session())
      
        function ensureAuthenticated(req, res, next) {
          if (req.isAuthenticated()) {
              return next()
          }
          console.log('[ensureAuthenticated][redirect]') // !DEBUG
          res.redirect('/')
        }

        passport.serializeUser((user, done) => {
          done(null, user.id)
        })

        passport.deserializeUser((id, done) => {
            db.collection('socialusers').findOne(
                {id: id},
                (err, doc) => {
                    done(null, doc)
                }
            )
        })

      
        /*
        *  ADD YOUR CODE BELOW
        */
        passport.use(new GitHubStrategy({
            clientID: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackURL: "https://fcc-adv-node-exp-social-auth.herokuapp.com/auth/github/callback"
          },
          function(accessToken, refreshToken, profile, cb) {
            // returns the user profile from github API
            db.collection('socialusers').findAndModify(
              {id: profile.id},
              {},
              {$setOnInsert:{
                id: profile.id,
                name: profile.displayName || 'John Doe',
                // photo: profile.photos[0].value || '',
                // email: profile.emails[0].value || 'No public email',
                created_on: new Date(),
                provider: profile.provider || ''
              },$set:{
                last_login: new Date()
              },$inc:{
                login_count: 1
              }},
              {upsert:true, new: true},
              (err, doc) => {
                return cb(null, doc.value)
              }
            )
          }
        ))

        app.route('/auth/github').get(passport.authenticate('github'))
          
        app.route('/auth/github/callback')
        .get(passport.authenticate('github', { failureRedirect: '/' }), (req, res) => {
          console.log('[/auth/github/callback][redirect]') // !DEBUG
          res.redirect('/profile')
        })
      
      
        /*
        *  ADD YOUR CODE ABOVE
        */
      
      
        app.route('/')
          .get((req, res) => {
            res.render(process.cwd() + '/views/pug/index')
          })

        app.route('/profile')
          .get(ensureAuthenticated, (req, res) => {
               res.render(process.cwd() + '/views/pug/profile', {user: req.user})
          })

        app.route('/logout')
          .get((req, res) => {
              req.logout()
              res.redirect('/')
          })

        app.use((req, res, next) => {
          res.status(404)
            .type('text')
            .send('Not Found')
        })
      
        // Start server
        const PORT = process.env.PORT || 3000
        app.listen(PORT, () => console.log(`http://localhost:${PORT}`))  
}})
