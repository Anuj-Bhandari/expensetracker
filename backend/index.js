require('dotenv').config()

const express = require('express')

const mongoose = require('mongoose')    

const { secretkey } = require('./config')

const mongo = process.env.MongoDB_URL

const PORT = process.env.PORT ;

const {userRouter} = require("./user")
const { expenseRouter } = require('./expense')

const cors = require('cors');

const app = express()

app.use(cors())

app.use(express.json())

app.use("/user" ,userRouter)
app.use("/expense" ,expenseRouter)

async function Main() {

    try{
       const connection =  await mongoose.connect(mongo);
      console.log("Connected to the database");
      
    }catch
(error) {
        console.log("Error connecting to the database", error)
    }
}
app.listen(PORT , () => {
    console.log(`Server is running on port ${PORT}`);   
})

Main()

