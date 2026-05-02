exports.validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  if (
    !username ||
    typeof username !== "string" ||
    !password ||
    typeof password !== "string" ||
    password.length < 6
  ) {
    return res.status(400).json({ message: "All fields required" });
  }
  next();
};