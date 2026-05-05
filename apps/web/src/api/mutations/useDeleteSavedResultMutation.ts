import { useMutation } from "@tanstack/react-query";
import { request } from "../request";
import { apiRoutes } from "../routes";

export function useDeleteSavedResultMutation() {
  return useMutation({ mutationFn: deleteSavedResult });
}

async function deleteSavedResult(id: number) {
  await request<void>(apiRoutes.result(id), {
    method: "DELETE",
  });
}
