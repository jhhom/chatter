import { registerUser } from "~/backend/service/users/create-user.service";
import { findUsersToAddContact } from "~/backend/service/users/find-user.service";

const userUsecase = {
  registerUser,
  findUsersToAddContact,
};

export { userUsecase };
