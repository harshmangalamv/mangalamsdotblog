import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isSuperUser: { type: Boolean, default: true }, //untill not totally completed making it true- shoyld be dalse
});

const User = mongoose.model("User", UserSchema);
export default User;
