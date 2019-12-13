<!--
  - @copyright Copyright (c) 2019 Marco Ambrosini <marcoambrosini@pm.me>
  -
  - @author Marco Ambrosini <marcoambrosini@pm.me>
  -
  - @license GNU AGPL version 3 or any later version
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as
  - published by the Free Software Foundation, either version 3 of the
  - License, or (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  - GNU Affero General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with this program. If not, see <http://www.gnu.org/licenses/>.
-->

<template>
	<button v-if="showStartCallButton"
		:disabled="startCallButtonDisabled || loading"
		class="top-bar__button primary"
		@click="joinCall">
		{{ startCallLabel }}
	</button>
	<button v-else-if="showLeaveCallButton"
		class="top-bar__button primary"
		:disabled="loading"
		@click="leaveCall">
		{{ leaveCallLabel }}
	</button>
</template>

<script>
import { CONVERSATION, PARTICIPANT, WEBINAR } from '../../constants'

export default {
	name: 'CallButton',

	data() {
		return {
			loading: false,
		}
	},

	computed: {
		token() {
			return this.$store.getters.getToken()
		},

		conversation() {
			if (this.$store.getters.conversations[this.token]) {
				return this.$store.getters.conversations[this.token]
			}
			return {
				participantFlags: PARTICIPANT.CALL_FLAG.DISCONNECTED,
				participantType: PARTICIPANT.TYPE.USER,
				readOnly: CONVERSATION.STATE.READ_ONLY,
				hasCall: false,
				canStartCall: false,
				lobbyState: WEBINAR.LOBBY.NONE,
			}
		},

		participant() {
			const participantIndex = this.$store.getters.getParticipantIndex(this.token, this.$store.getters.getParticipantIdentifier())
			if (participantIndex !== -1) {
				console.debug('Current participant found')
				return this.$store.getters.getParticipant(this.token, participantIndex)
			}

			console.debug('Current participant not found')
			return {
				inCall: PARTICIPANT.CALL_FLAG.DISCONNECTED,
			}
		},

		isBlockedByLobby() {
			return this.conversation.lobbyState === WEBINAR.LOBBY.NON_MODERATORS
				&& this.isParticipantTypeModerator(this.conversation.participantType)
		},

		startCallButtonDisabled() {
			return (!this.conversation.canStartCall
					&& !this.conversation.hasCall)
				|| this.isBlockedByLobby
		},

		leaveCallLabel() {
			if (this.loading) {
				return t('spreed', 'Leaving call')
			}

			return t('spreed', 'Leave call')
		},

		startCallLabel() {
			if (this.loading) {
				return t('spreed', 'Joining call')
			}

			if (this.conversation.hasCall && !this.isBlockedByLobby) {
				return t('spreed', 'Join call')
			}

			return t('spreed', 'Start call')
		},

		showStartCallButton() {
			return this.conversation.readOnly === CONVERSATION.STATE.READ_WRITE
				&& this.participant.inCall === PARTICIPANT.CALL_FLAG.DISCONNECTED
		},

		showLeaveCallButton() {
			return this.conversation.readOnly === CONVERSATION.STATE.READ_WRITE
				&& this.participant.inCall !== PARTICIPANT.CALL_FLAG.DISCONNECTED
		},
	},

	methods: {
		isParticipantTypeModerator(participantType) {
			return [PARTICIPANT.TYPE.OWNER, PARTICIPANT.TYPE.MODERATOR, PARTICIPANT.TYPE.GUEST_MODERATOR].indexOf(participantType) !== -1
		},

		async joinCall() {
			console.info('Joining call')
			this.loading = true
			await this.$store.dispatch('joinCall', {
				token: this.token,
				participantIdentifier: this.$store.getters.getParticipantIdentifier(),
				flags: PARTICIPANT.CALL_FLAG.IN_CALL, // FIXME add audio+video as per setting
			})
			this.loading = false
		},

		async leaveCall() {
			console.info('Leaving call')
			this.loading = true
			await this.$store.dispatch('leaveCall', {
				token: this.token,
				participantIdentifier: this.$store.getters.getParticipantIdentifier(),
			})
			this.loading = false
		},
	},
}
</script>

<style lang="scss" scoped>

</style>