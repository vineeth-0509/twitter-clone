import User from "../models/user.model.js";
import Notification from "./notification.model.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import {v2 as cloudinary} from "cloudinary";

export const getUserProfile = async (req, res) => {
  const { username } = req.params;
  try {
    const user = await User.findOne({ username }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    console.log("Error in getUserProfile", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const followUnfollowUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userToModify = await User.findById(id);
    const currentUser = await User.findById(req.user._id);

    if (id === req.user._id.toString()) {
      return res
        .status(400)
        .json({ error: "You can't follow/unfollow yourself" });
    }
    if (!userToModify || !currentUser)
      return res.status(400).json({ error: "User not found" });

    const isFolllowing = currentUser.following.includes(id);
    if (isFolllowing) {
      await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } });
      await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } });
      res.status(200).json({ message: "User unfollowed successful" });
    } else {
      //follow the user
      await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } });
      await User.findByIdAndUpdate(req.user._id, { $push: { following: id } });
      //send the notification to the user
      const newNotification = new Notification({
        type: "follow",
        from: req.user._id,
        to: userToModify._id,
      });
      await newNotification.save();
      // todo return the id of the user as a response.
      res.status(200).json({ message: "User followed succesfully" });
    }
  } catch (error) {
    console.log("Error in followUnfollowUser: ", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const getSuggestedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const usersFollowedByMe = await User.findById(userId).select("following");
    const users = await User.aggregate([
      {
        $match: {
          _id: { $ne:new  mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $sample: { size: 10 },
      },
    ]);
    const filteredUsers = users.filter(
      (user) => !usersFollowedByMe.following.includes(user._id),
    );
    const suggestedUsers = filteredUsers.slice(0, 4);
    suggestedUsers.forEach((user) => (user.password = null));
    res.status(200).json(suggestedUsers);
  } catch (error) {
    console.log("Error in getSuggestedUsers:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const updateUserProfile = async(req, res) => {
  const {username, fullName, currentPassword, newPassword, bio, link, email} = req.body;
    let { profileImg, coverImg} = req.body;
    const userId = req.user._id;
  try {
    const user = await User.findById(userId);
    if(!userId) return res.status(404).json({message:"user not found"});

    if((!newPassword && currentPassword) || (!currentPassword && newPassword)){
      return res.status(400).json({message:"please provide both the current password and new password"});
    }
    if(currentPassword && newPassword){
      const isMatch = await bcrypt.compare(currentPassword,user.password);
      if(!isMatch) return res.status(400).json({message:"current password is incorrect"})
       if(newPassword.length < 6 ){ return res.status(400).json({error:"password must be at least 6 characters long"}) }
    
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
}

  if(profileImg || coverImg){
    const updateImage = profileImg? user.profileImg: user.coverImg;
    try {
      if(updateImage){
        await cloudinary.uploader.destroy(user.updateImage.split('/').pop().split(".")[0]);
      }
    } catch (error) {
      console.error("Error destroying image:", error);
    }
  }
  const imageToUpload = profileImg || coverImg;
  try {
    const uploadedResponse = await cloudinary.uploader.upload(imageToUpload);
    if(uploadedResponse){
     profileImg? (user.profileImg = uploadedResponse.secure_url) : (user.coverImg = uploadedResponse.secure_url);
    }
  } catch (error) {
    console.log("Error in uploading image:", error);
  }
  
  // user.fullName = fullName || user.fullName;
  // user.email = email || user.email;
  // user.username = username || user.username;
  // user.bio = bio || user.bio;
  // user.link = link || user.link;
  // user.profileImg = profileImg || user.profileImg;
  // user.coverImg = coverImg || user.coverImg;
  //  user = await user.save();
  //  return res.status(200).json(user);

  const updatedUser = await User.findByIdAndUpdate(userId,{
    $set:{
      username: username || user.username,
      fullName : fullName || user.fullName,
      bio: bio || user.bio,
      link: link|| user.link,
      email: email || user.email,
      profileImg : profileImg || user.profileImg,
      coverImg : coverImg || user.coverImg,
      password: user.password
    },
  },{ new: true, upsert:false});
  user.password = null;

  return res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in the updateUserProfile",error.message);
    res.status(500).json({ error: error.message });
  }
}
