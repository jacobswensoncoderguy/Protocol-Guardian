import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compound } from '@/data/compounds';

export interface HouseholdMember {
  linkId: string;
  userId: string;
  displayName: string | null;
  email: string | null; // fallback when no display_name
  status: 'pending' | 'accepted' | 'rejected';
  isRequester: boolean; // true if current user sent the invite
}

export interface HouseholdLink {
  id: string;
  requester_id: string;
  member_id: string;
  status: string;
  invite_token: string | null;
  created_at: string;
}

export function useHousehold(userId?: string) {
  const [links, setLinks] = useState<HouseholdLink[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('household_links')
      .select('*')
      .or(`requester_id.eq.${userId},member_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch household links:', error);
      setLoading(false);
      return;
    }

    setLinks(data || []);

  // For each link, fetch the other user's profile + use invite_token as email fallback
    const enriched: HouseholdMember[] = [];
    for (const link of (data || [])) {
      const otherUserId = link.requester_id === userId ? link.member_id : link.requester_id;
      const { data: profileData } = await (supabase as any)
        .from('profiles')
        .select('display_name')
        .eq('user_id', otherUserId)
        .maybeSingle();

      const displayName: string | null = profileData?.display_name || null;
      // invite_token stores the invited member's email prefixed with "email:"
      // so we can show it as a fallback when display_name is not set
      const storedToken: string | null = link.invite_token || null;
      const emailFallback = storedToken?.startsWith('email:')
        ? storedToken.slice(6)
        : null;

      enriched.push({
        linkId: link.id,
        userId: otherUserId,
        displayName,
        email: emailFallback,
        status: link.status as 'pending' | 'accepted' | 'rejected',
        isRequester: link.requester_id === userId,
      });
    }
    setMembers(enriched);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const sendInvite = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'Not authenticated' };

    // Find user by email using the security definer function
    const { data: foundUsers, error: findError } = await (supabase as any)
      .rpc('find_user_for_household', { lookup_email: email });

    if (findError || !foundUsers || foundUsers.length === 0) {
      return { success: false, error: 'No PROTOCOL Guardian account found with that email.' };
    }

    const targetUser = foundUsers[0];

    // Check if link already exists
    const exists = links.some(l =>
      (l.requester_id === userId && l.member_id === targetUser.user_id) ||
      (l.requester_id === targetUser.user_id && l.member_id === userId)
    );
    if (exists) {
      return { success: false, error: 'A household link already exists with this user.' };
    }

    const { error: insertError } = await (supabase as any)
      .from('household_links')
      .insert({
        requester_id: userId,
        member_id: targetUser.user_id,
        status: 'pending',
        // Store invited email as fallback display label (prefix to distinguish from real tokens)
        invite_token: `email:${email}`,
      });

    if (insertError) {
      return { success: false, error: 'Failed to send invite. Please try again.' };
    }

    await fetchLinks();
    return { success: true };
  }, [userId, links, fetchLinks]);

  const acceptInvite = useCallback(async (linkId: string) => {
    const { error } = await (supabase as any)
      .from('household_links')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', linkId);
    if (!error) await fetchLinks();
    return !error;
  }, [fetchLinks]);

  const rejectInvite = useCallback(async (linkId: string) => {
    const { error } = await (supabase as any)
      .from('household_links')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', linkId);
    if (!error) await fetchLinks();
    return !error;
  }, [fetchLinks]);

  const removeLink = useCallback(async (linkId: string) => {
    const { error } = await (supabase as any)
      .from('household_links')
      .delete()
      .eq('id', linkId);
    if (!error) await fetchLinks();
    return !error;
  }, [fetchLinks]);

  const acceptedMembers = members.filter(m => m.status === 'accepted');
  const pendingIncoming = members.filter(m => m.status === 'pending' && !m.isRequester);
  const pendingOutgoing = members.filter(m => m.status === 'pending' && m.isRequester);

  return {
    members,
    acceptedMembers,
    pendingIncoming,
    pendingOutgoing,
    loading,
    sendInvite,
    acceptInvite,
    rejectInvite,
    removeLink,
    refetch: fetchLinks,
  };
}

// Hook to load compounds for a specific (linked) household member
export function useHouseholdMemberCompounds(memberUserId: string | null) {
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCompounds = useCallback(async () => {
    if (!memberUserId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('user_compounds')
      .select('*')
      .eq('user_id', memberUserId);

    if (!error && data) {
      const mapped: Compound[] = data.map((c: any) => ({
        id: c.id,
        compoundId: c.compound_id,
        name: c.name,
        category: c.category,
        dosePerUse: c.dose_per_use,
        doseLabel: c.dose_label,
        unitLabel: c.unit_label,
        unitSize: c.unit_size,
        unitPrice: c.unit_price,
        dosesPerDay: c.doses_per_day,
        daysPerWeek: c.days_per_week,
        currentQuantity: c.current_quantity,
        reorderQuantity: c.reorder_quantity,
        reorderType: c.reorder_type || 'single',
        timingNote: c.timing_note || '',
        notes: c.notes || '',
        purchaseDate: c.purchase_date,
        cycleOnDays: c.cycle_on_days,
        cycleOffDays: c.cycle_off_days,
        cycleStartDate: c.cycle_start_date,
        cyclingNote: c.cycling_note,
        bacstatPerVial: c.bacstat_per_vial,
        reconVolume: c.recon_volume,
        vialSizeMl: c.vial_size_ml,
        kitPrice: c.kit_price,
        weightPerUnit: c.weight_per_unit,
        paused_at: c.paused_at,
        pauseRestartDate: c.pause_restart_date,
      }));
      setCompounds(mapped);
    }
    setLoading(false);
  }, [memberUserId]);

  useEffect(() => {
    fetchCompounds();
  }, [fetchCompounds]);

  return { compounds, loading };
}
