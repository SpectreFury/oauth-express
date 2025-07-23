import express, {Request, Response} from 'express'
const app = express()

app.get("/", (req: Request, res: Response) => {
  console.log("Method: ", req.method)

  res.send("This is a response")
})

app.listen(3000, () => {
  console.log("Listening")
}) 

