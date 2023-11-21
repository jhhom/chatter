import { registerUser } from "~/backend/service/users/create-user.service";
import { findUsersToAddContact } from "~/backend/service/users/find-user.service";
import { deleteUser } from "~/backend/service/users/delete-user.service";

const userUsecase = {
  registerUser,
  findUsersToAddContact,
  deleteUser,
};

export { userUsecase };
