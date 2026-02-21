import { nanoid } from "nanoid";

export function requestContext() {
  return (req, res, next) => {
    const requestId = req.headers["x-request-id"] || nanoid(12);
    req.requestId = String(requestId);
    res.setHeader("x-request-id", req.requestId);
    next();
  };
}