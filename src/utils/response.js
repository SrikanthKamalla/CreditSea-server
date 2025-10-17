const sendResponse = (res, success, message, data, status = 200) => {
  res.status(status).send({
    success,
    message,
    data,
  });
};
export default sendResponse;
