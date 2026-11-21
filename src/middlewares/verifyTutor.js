export const verifyTutor = (req, res, next) => {
  if (req.user?.role !== "tutor") {
    return res.status(403).json({ message: "Tutor access required." });
  }

  return next();
};
