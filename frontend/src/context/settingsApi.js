import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const getUserSettings = async (userId) => {
  const response = await axios.get(`${BASE_URL}/settings/${userId}`);
  return response.data;
};

export const updateUserSettings = async (userId, settings) => {
  const response = await axios.put(`${BASE_URL}/settings/${userId}`, settings);
  return response.data;
};

export const getUserProfile = async (userId) => {
  const response = await axios.get(`${BASE_URL}/profile/${userId}`);
  return response.data;
};

export const updateUserProfile = async (userId, profile) => {
  const response = await axios.put(`${BASE_URL}/profile/${userId}`, profile);
  return response.data;
};

export const getUserActivity = async (userId) => {
  const response = await axios.get(`${BASE_URL}/activity/${userId}`);
  return response.data;
};

export const logUserActivity = async (userId, activity) => {
  const response = await axios.post(`${BASE_URL}/activity/${userId}`, activity);
  return response.data;
};

export const getUserNotifications = async (userId) => {
  const response = await axios.get(`${BASE_URL}/notifications/${userId}`);
  return response.data;
};

export const markNotificationRead = async (userId, notificationId) => {
  const response = await axios.put(`${BASE_URL}/notifications/${userId}/${notificationId}/read`);
  return response.data;
};

export const getUserPreferences = async (userId) => {
  const response = await axios.get(`${BASE_URL}/preferences/${userId}`);
  return response.data;
};

export const updateUserPreferences = async (userId, preferences) => {
  const response = await axios.put(`${BASE_URL}/preferences/${userId}`, preferences);
  return response.data;
};

export const getUserTheme = async (userId) => {
  const response = await axios.get(`${BASE_URL}/theme/${userId}`);
  return response.data;
};

export const updateUserTheme = async (userId, theme) => {
  const response = await axios.put(`${BASE_URL}/theme/${userId}`, theme);
  return response.data;
};

export const getUserLanguage = async (userId) => {
  const response = await axios.get(`${BASE_URL}/language/${userId}`);
  return response.data;
};

export const updateUserLanguage = async (userId, language) => {
  const response = await axios.put(`${BASE_URL}/language/${userId}`, language);
  return response.data;
};

export const getUserPrivacy = async (userId) => {
  const response = await axios.get(`${BASE_URL}/privacy/${userId}`);
  return response.data;
};

export const updateUserPrivacy = async (userId, privacy) => {
  const response = await axios.put(`${BASE_URL}/privacy/${userId}`, privacy);
  return response.data;
};

export const getUserSecurity = async (userId) => {
  const response = await axios.get(`${BASE_URL}/security/${userId}`);
  return response.data;
};

export const updateUserSecurity = async (userId, security) => {
  const response = await axios.put(`${BASE_URL}/security/${userId}`, security);
  return response.data;
};

export const getUserBlockedList = async (userId) => {
  const response = await axios.get(`${BASE_URL}/blocked/${userId}`);
  return response.data;
};

export const blockUser = async (userId, blockedId) => {
  const response = await axios.post(`${BASE_URL}/blocked/${userId}`, { blockedId });
  return response.data;
};

export const unblockUser = async (userId, blockedId) => {
  const response = await axios.delete(`${BASE_URL}/blocked/${userId}/${blockedId}`);
  return response.data;
};

export const getUserDevices = async (userId) => {
  const response = await axios.get(`${BASE_URL}/devices/${userId}`);
  return response.data;
};

export const addUserDevice = async (userId, device) => {
  const response = await axios.post(`${BASE_URL}/devices/${userId}`, device);
  return response.data;
};

export const removeUserDevice = async (userId, deviceId) => {
  const response = await axios.delete(`${BASE_URL}/devices/${userId}/${deviceId}`);
  return response.data;
};

export const getUserSessions = async (userId) => {
  const response = await axios.get(`${BASE_URL}/sessions/${userId}`);
  return response.data;
};

export const endUserSession = async (userId, sessionId) => {
  const response = await axios.delete(`${BASE_URL}/sessions/${userId}/${sessionId}`);
  return response.data;
};

export const getUserHistory = async (userId) => {
  const response = await axios.get(`${BASE_URL}/history/${userId}`);
  return response.data;
};

export const clearUserHistory = async (userId) => {
  const response = await axios.delete(`${BASE_URL}/history/${userId}`);
  return response.data;
};

export const getUserFavorites = async (userId) => {
  const response = await axios.get(`${BASE_URL}/favorites/${userId}`);
  return response.data;
};

export const addUserFavorite = async (userId, favoriteId) => {
  const response = await axios.post(`${BASE_URL}/favorites/${userId}`, { favoriteId });
  return response.data;
};

export const removeUserFavorite = async (userId, favoriteId) => {
  const response = await axios.delete(`${BASE_URL}/favorites/${userId}/${favoriteId}`);
  return response.data;
};

export const getUserPlaylists = async (userId) => {
  const response = await axios.get(`${BASE_URL}/playlists/${userId}`);
  return response.data;
};

export const createUserPlaylist = async (userId, playlist) => {
  const response = await axios.post(`${BASE_URL}/playlists/${userId}`, playlist);
  return response.data;
};

export const updateUserPlaylist = async (userId, playlistId, playlist) => {
  const response = await axios.put(`${BASE_URL}/playlists/${userId}/${playlistId}`, playlist);
  return response.data;
};

export const deleteUserPlaylist = async (userId, playlistId) => {
  const response = await axios.delete(`${BASE_URL}/playlists/${userId}/${playlistId}`);
  return response.data;
};

export const getUserAlbums = async (userId) => {
  const response = await axios.get(`${BASE_URL}/albums/${userId}`);
  return response.data;
};

export const addUserAlbum = async (userId, albumId) => {
  const response = await axios.post(`${BASE_URL}/albums/${userId}`, { albumId });
  return response.data;
};

export const removeUserAlbum = async (userId, albumId) => {
  const response = await axios.delete(`${BASE_URL}/albums/${userId}/${albumId}`);
  return response.data;
};

export const getUserArtists = async (userId) => {
  const response = await axios.get(`${BASE_URL}/artists/${userId}`);
  return response.data;
};

export const addUserArtist = async (userId, artistId) => {
  const response = await axios.post(`${BASE_URL}/artists/${userId}`, { artistId });
  return response.data;
};

export const removeUserArtist = async (userId, artistId) => {
  const response = await axios.delete(`${BASE_URL}/artists/${userId}/${artistId}`);
  return response.data;
};

export const getUserRecommendations = async (userId) => {
  const response = await axios.get(`${BASE_URL}/recommendations/${userId}`);
  return response.data;
};

export const getUserStats = async (userId) => {
  const response = await axios.get(`${BASE_URL}/stats/${userId}`);
  return response.data;
};

export const getUserReports = async (userId) => {
  const response = await axios.get(`${BASE_URL}/reports/${userId}`);
  return response.data;
};

export const submitUserReport = async (userId, report) => {
  const response = await axios.post(`${BASE_URL}/reports/${userId}`, report);
  return response.data;
};

export const getUserSupportTickets = async (userId) => {
  const response = await axios.get(`${BASE_URL}/support/${userId}`);
  return response.data;
};

export const submitUserSupportTicket = async (userId, ticket) => {
  const response = await axios.post(`${BASE_URL}/support/${userId}`, ticket);
  return response.data;
};

export const getUserIntegrations = async (userId) => {
  const response = await axios.get(`${BASE_URL}/integrations/${userId}`);
  return response.data;
};

export const addUserIntegration = async (userId, integration) => {
  const response = await axios.post(`${BASE_URL}/integrations/${userId}`, integration);
  return response.data;
};

export const removeUserIntegration = async (userId, integrationId) => {
  const response = await axios.delete(`${BASE_URL}/integrations/${userId}/${integrationId}`);
  return response.data;
};

export const getUserLogs = async (userId) => {
  const response = await axios.get(`${BASE_URL}/logs/${userId}`);
  return response.data;
};

export const addUserLog = async (userId, log) => {
  const response = await axios.post(`${BASE_URL}/logs/${userId}`, log);
  return response.data;
};

export const getUserAchievements = async (userId) => {
  const response = await axios.get(`${BASE_URL}/achievements/${userId}`);
  return response.data;
};

export const addUserAchievement = async (userId, achievement) => {
  const response = await axios.post(`${BASE_URL}/achievements/${userId}`, achievement);
  return response.data;
};

export const removeUserAchievement = async (userId, achievementId) => {
  const response = await axios.delete(`${BASE_URL}/achievements/${userId}/${achievementId}`);
  return response.data;
};

export const getUserBadges = async (userId) => {
  const response = await axios.get(`${BASE_URL}/badges/${userId}`);
  return response.data;
};

export const addUserBadge = async (userId, badge) => {
  const response = await axios.post(`${BASE_URL}/badges/${userId}`, badge);
  return response.data;
};

export const removeUserBadge = async (userId, badgeId) => {
  const response = await axios.delete(`${BASE_URL}/badges/${userId}/${badgeId}`);
  return response.data;
};

export const getUserInvites = async (userId) => {
  const response = await axios.get(`${BASE_URL}/invites/${userId}`);
  return response.data;
};

export const sendUserInvite = async (userId, invite) => {
  const response = await axios.post(`${BASE_URL}/invites/${userId}`, invite);
  return response.data;
};

export const revokeUserInvite = async (userId, inviteId) => {
  const response = await axios.delete(`${BASE_URL}/invites/${userId}/${inviteId}`);
  return response.data;
};

export const getUserConnections = async (userId) => {
  const response = await axios.get(`${BASE_URL}/connections/${userId}`);
  return response.data;
};

export const addUserConnection = async (userId, connection) => {
  const response = await axios.post(`${BASE_URL}/connections/${userId}`, connection);
  return response.data;
};

export const removeUserConnection = async (userId, connectionId) => {
  const response = await axios.delete(`${BASE_URL}/connections/${userId}/${connectionId}`);
  return response.data;
};

export const getUserFeedback = async (userId) => {
  const response = await axios.get(`${BASE_URL}/feedback/${userId}`);
  return response.data;
};

export const submitUserFeedback = async (userId, feedback) => {
  const response = await axios.post(`${BASE_URL}/feedback/${userId}`, feedback);
  return response.data;
};

export const getUserAnnouncements = async (userId) => {
  const response = await axios.get(`${BASE_URL}/announcements/${userId}`);
  return response.data;
};

export const getUserSystemStatus = async (userId) => {
  const response = await axios.get(`${BASE_URL}/system/${userId}`);
  return response.data;
};

export const getUserBilling = async (userId) => {
  const response = await axios.get(`${BASE_URL}/billing/${userId}`);
  return response.data;
};

export const updateUserBilling = async (userId, billing) => {
  const response = await axios.put(`${BASE_URL}/billing/${userId}`, billing);
  return response.data;
};

export const getUserSubscription = async (userId) => {
  const response = await axios.get(`${BASE_URL}/subscription/${userId}`);
  return response.data;
};

export const updateUserSubscription = async (userId, subscription) => {
  const response = await axios.put(`${BASE_URL}/subscription/${userId}`, subscription);
  return response.data;
};

export const getUserInvoices = async (userId) => {
  const response = await axios.get(`${BASE_URL}/invoices/${userId}`);
  return response.data;
};

export const getUserPayments = async (userId) => {
  const response = await axios.get(`${BASE_URL}/payments/${userId}`);
  return response.data;
};

export const submitUserPayment = async (userId, payment) => {
  const response = await axios.post(`${BASE_URL}/payments/${userId}`, payment);
  return response.data;
};

export const getUserRefunds = async (userId) => {
  const response = await axios.get(`${BASE_URL}/refunds/${userId}`);
  return response.data;
};

export const requestUserRefund = async (userId, refund) => {
  const response = await axios.post(`${BASE_URL}/refunds/${userId}`, refund);
  return response.data;
};

export const getUserAffiliates = async (userId) => {
  const response = await axios.get(`${BASE_URL}/affiliates/${userId}`);
  return response.data;
};

export const addUserAffiliate = async (userId, affiliate) => {
  const response = await axios.post(`${BASE_URL}/affiliates/${userId}`, affiliate);
  return response.data;
};

export const removeUserAffiliate = async (userId, affiliateId) => {
  const response = await axios.delete(`${BASE_URL}/affiliates/${userId}/${affiliateId}`);
  return response.data;
};

export const getUserMarketing = async (userId) => {
  const response = await axios.get(`${BASE_URL}/marketing/${userId}`);
  return response.data;
};

export const updateUserMarketing = async (userId, marketing) => {
  const response = await axios.put(`${BASE_URL}/marketing/${userId}`, marketing);
  return response.data;
};

export const getUserExperiments = async (userId) => {
  const response = await axios.get(`${BASE_URL}/experiments/${userId}`);
  return response.data;
};

export const updateUserExperiments = async (userId, experiments) => {
  const response = await axios.put(`${BASE_URL}/experiments/${userId}`, experiments);
  return response.data;
};

export const getUserBetaFeatures = async (userId) => {
  const response = await axios.get(`${BASE_URL}/beta/${userId}`);
  return response.data;
};

export const updateUserBetaFeatures = async (userId, betaFeatures) => {
  const response = await axios.put(`${BASE_URL}/beta/${userId}`, betaFeatures);
  return response.data;
};

export const getUserAccessibility = async (userId) => {
  const response = await axios.get(`${BASE_URL}/accessibility/${userId}`);
  return response.data;
};

export const updateUserAccessibility = async (userId, accessibility) => {
  const response = await axios.put(`${BASE_URL}/accessibility/${userId}`, accessibility);
  return response.data;
};

export const getUserLegal = async (userId) => {
  const response = await axios.get(`${BASE_URL}/legal/${userId}`);
  return response.data;
};

export const getUserTerms = async (userId) => {
  const response = await axios.get(`${BASE_URL}/terms/${userId}`);
  return response.data;
};

export const getUserPolicy = async (userId) => {
  const response = await axios.get(`${BASE_URL}/policy/${userId}`);
  return response.data;
};

export const getUserCookies = async (userId) => {
  const response = await axios.get(`${BASE_URL}/cookies/${userId}`);
  return response.data;
};

export const updateUserCookies = async (userId, cookies) => {
  const response = await axios.put(`${BASE_URL}/cookies/${userId}`, cookies);
  return response.data;
};

export const getUserDataExport = async (userId) => {
  const response = await axios.get(`${BASE_URL}/data-export/${userId}`);
  return response.data;
};

export const requestUserDataExport = async (userId) => {
  const response = await axios.post(`${BASE_URL}/data-export/${userId}`);
  return response.data;
};

export const getUserDataImport = async (userId) => {
  const response = await axios.get(`${BASE_URL}/data-import/${userId}`);
  return response.data;
};

export const submitUserDataImport = async (userId, data) => {
  const response = await axios.post(`${BASE_URL}/data-import/${userId}`, data);
  return response.data;
};

export const getUserDataDelete = async (userId) => {
  const response = await axios.get(`${BASE_URL}/data-delete/${userId}`);
  return response.data;
};

export const requestUserDataDelete = async (userId) => {
  const response = await axios.post(`${BASE_URL}/data-delete/${userId}`);
  return response.data;
};
