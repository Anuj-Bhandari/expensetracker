const mongoose = require('mongoose'); 

const Schema = mongoose.Schema;

const ObjectId = mongoose.Types.ObjectId;

const userSchema = new Schema({
    email: { type: String, unique: true },
    password: String,
    name : String
});

const ExpenseSchema = new Schema({
    title: String,  
    description: String,
    amount: Number,
    date: Date,
    type: {
  type: String,
  enum: ['income', 'expense'],
  required: true
},
    userId: {
  type: mongoose.Schema.Types.ObjectId,
  required: true
}
})

const expenseModel = mongoose.model("expense", ExpenseSchema);
const userModel = mongoose.model("user", userSchema);

module.exports = {
    expenseModel,
    userModel
};   