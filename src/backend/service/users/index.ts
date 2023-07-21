import { registerUser } from "./use-cases/create-user/create-user";
import { findUsersToAddContact } from "./use-cases/find-users/find-user";

const userUsecase = {
  registerUser,
  findUsersToAddContact,
};
export { userUsecase };
