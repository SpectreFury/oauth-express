import express from 'express';
const app = express();
app.get("/", (req, res) => {
    console.log("Method: ", req.method);
    res.send("This is a response");
});
app.listen(3000, () => {
    console.log("Listening");
});
