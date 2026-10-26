import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { BranchOption, LocationOption } from '../SaleVoucherTypes';

/**
 * The Branch a Sale or Sale Return is made at. Branch users always work in their own Branch (fixed);
 * All Branches users choose one. Call this before loading support data, which depends on the Branch.
 */
export function useSaleBranch() {
  const { data: session } = useSession();
  const isBranchUser = session?.user.accessLevel === 'BRANCH';
  const ownBranchId = isBranchUser ? session?.user.branch?.id ?? '' : '';
  const [chosenBranchId, setChosenBranchId] = useState('');
  const [locationId, setLocationId] = useState('');

  function changeBranch(value: string) {
    if (isBranchUser) return;
    setChosenBranchId(value);
    setLocationId('');
  }

  return {
    branchId: isBranchUser ? ownBranchId : chosenBranchId,
    isBranchUser,
    locationId,
    setLocationId,
    changeBranch,
  };
}

/**
 * Applies the loaded Branch list: picks the default Branch for All Branches users and keeps the
 * optional shelf Location inside the chosen Branch.
 */
export function useSaleBranchOptions(branch: ReturnType<typeof useSaleBranch>, branches: BranchOption[], locations: LocationOption[]) {
  const { branchId, isBranchUser, locationId, setLocationId, changeBranch } = branch;
  const defaultBranchId = branches.find(option => option.isDefault)?.value ?? branches[0]?.value ?? '';

  useEffect(() => {
    if (!isBranchUser && !branchId && defaultBranchId) changeBranch(defaultBranchId);
  }, [branchId, changeBranch, defaultBranchId, isBranchUser]);

  const branchLocations = useMemo(() => locations.filter(location => location.branchId === branchId), [branchId, locations]);

  useEffect(() => {
    if (locationId && !branchLocations.some(location => location.value === locationId)) setLocationId('');
  }, [branchLocations, locationId, setLocationId]);

  return {
    selectedBranch: branches.find(option => option.value === branchId),
    branchLocations,
    resetBranch: () => {
      if (!isBranchUser && defaultBranchId) changeBranch(defaultBranchId);
      setLocationId('');
    },
  };
}
