import mongoose from "mongoose";

const atsResumeSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  resume_json: { type: Object, required: false },
  ats_result: { type: Object, required: false },
  improved_resume_json: { type: Object, required: false },
  created_at: { type: Date, default: Date.now },
  expires_at: { type: Date }
});

export default mongoose.model("ATSResume", atsResumeSchema);