export enum ServiceStatusId {
  Created = '1',
  Pending = '2',
  Approved = '3',
  Rejected = '4',
  Completed = '5',
  Finished = '6',
}

const chatEnabledStatuses = new Set<string>([
  ServiceStatusId.Approved,
  ServiceStatusId.Completed,
]);

export const isChatOpenStatus = (statusId: string | null | undefined): boolean => {
  if (!statusId) {
    return false;
  }

  return chatEnabledStatuses.has(statusId);
};
