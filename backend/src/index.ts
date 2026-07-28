import app from './app';

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`API Server listening at http://localhost:${port}`);
});
