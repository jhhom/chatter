import { default as _jwt } from "jsonwebtoken";
import { Result, ok, err, fromPromise } from "neverthrow";

import { default as _bcrypt } from "bcrypt";

// doesn't work because of overloads
// we don't know which argument is used, so we also don't know the return type
// to know the return type, we need to specialize from the overload
// const sign = Result.fromThrowable(_jwt.sign, (err) => err);

const jwt = {
  verify: (
    token: string,
    secretOrPublicKey: _jwt.Secret,
    options?: _jwt.VerifyOptions
  ) => {
    let result;
    try {
      result = _jwt.verify(token, secretOrPublicKey, options);
    } catch (e) {
      return err(e);
    }
    return ok(result);
  },
  sign: (
    payload: Parameters<typeof _jwt.sign>[0],
    secretOrPrivateKey: _jwt.Secret,
    options?: _jwt.SignOptions
  ) => {
    let result;
    try {
      result = _jwt.sign(payload, secretOrPrivateKey, options);
    } catch (e) {
      return err(e);
    }
    return ok(result);
  },
};

const bcrypt = {
  compare: (data: string | Buffer, encrypted: string) => {
    return fromPromise(_bcrypt.compare(data, encrypted), (err) => err);
  },
  hash: (data: string | Buffer, saltOrRounds: string | number) => {
    return fromPromise(_bcrypt.hash(data, saltOrRounds), (err) => err);
  },
};

export { jwt, bcrypt };
