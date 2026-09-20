// Intake fields mirror docs/data/collection-brief.md; this is not a public API.
const tab = (key, required, optional = '') => ({ key: key.split(' '), required: required.split(' '), fields: `${required} ${optional}`.trim().split(/\s+/) });
export const schema = {
  artists: tab('artist_id', 'artist_id entity_type name_ko name_en official_url source_ids', 'aliases birthday_mm_dd debut_date anniversary_date fandom_name image_asset_id agency_label row_note'),
  artist_relations: tab('relation_id', 'relation_id parent_artist_id child_artist_id relation_type source_ids', 'valid_from valid_to status'),
  places: tab('place_id', 'place_id name_ko name_en category city district address_ko floor operating_status source_ids', 'address_en neighborhood map_url latitude longitude coordinate_source_id price_amount currency accessibility language_support payment_support visit_minutes_estimate'),
  events: tab('event_id', 'event_id title_ko title_en event_type place_id organizer_name organizer_type start_date end_date timezone status reservation_status admission_condition source_ids', 'reservation_url booking_start booking_end overseas_booking_conditions price_amount currency age_condition series_id'),
  event_artists: tab('event_id artist_id', 'event_id artist_id relevance_type source_ids', 'description'),
  place_artists: tab('place_id artist_id', 'place_id artist_id relevance_type source_ids', 'content_date video_timestamp description'),
  hours: tab('hours_id', 'hours_id target_type target_id schedule_type state opens closes timezone source_ids', 'date weekday last_entry last_order close_day_offset'),
  benefits: tab('benefit_id', 'benefit_id event_id required_action benefit availability_status source_ids', 'price_amount currency applicable_date quantity per_person_limit first_come sold_out_at'),
  sources: tab('source_id', 'source_id target_type target_id supported_fields url publisher checked_at review_status collection_method reuse_status', 'published_at collector_alias reviewer_alias conflict_note terms_url permission_reference change_note'),
  assets: tab('asset_id', 'asset_id original_url rights_holder permission_status evidence_reference', 'allowed_use attribution expires_at file_reference'),
  event_sessions: tab('session_id', 'session_id event_id date starts_at ends_at source_ids', 'row_note'),
  booking_windows: tab('booking_id', 'booking_id event_id session_id booking_type opens_at closes_at reservation_status source_ids', 'reservation_url price_amount currency per_person_limit eligibility row_note'),
  event_conditions: tab('condition_id', 'condition_id event_id condition_type applies_to value source_ids', 'row_note'),
};
export const tabs = Object.keys(schema);
export const optionalTabs = ['event_sessions', 'booking_windows', 'event_conditions'];
export const enums = {
  entity_type: ['group', 'person', 'unit'], relation_type: ['member_of', 'unit_of'],
  organizer_type: ['official', 'fan', 'store', 'unknown'],
  reservation_status: ['required', 'optional', 'not_required', 'unknown'],
  schedule_type: ['date', 'weekday'], state: ['open', 'closed', 'unknown'],
};
