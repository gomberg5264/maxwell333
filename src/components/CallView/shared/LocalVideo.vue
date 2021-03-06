<!--
  - @copyright Copyright (c) 2019, Daniel Calviño Sánchez (danxuliu@gmail.com)
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
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU Affero General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with this program. If not, see <http://www.gnu.org/licenses/>.
  -
  -->

<template>
	<div id="localVideoContainer"
		class="videoContainer videoView"
		:class="videoContainerClass">
		<video v-show="localMediaModel.attributes.videoEnabled"
			id="localVideo"
			ref="video"
			:class="videoClass"
			class="video" />
		<div v-if="!localMediaModel.attributes.videoEnabled && !isSidebar" class="avatar-container">
			<VideoBackground
				v-if="isGrid || isStripe"
				:display-name="displayName"
				:user="userId" />
			<Avatar v-if="userId"
				:size="avatarSize"
				:disable-menu="true"
				:disable-tooltip="true"
				:user="userId"
				:display-name="displayName" />
			<div v-if="!userId"
				:class="avatarSizeClass"
				class="avatar guest">
				{{ firstLetterOfGuestName }}
			</div>
		</div>
		<transition name="fade">
			<LocalMediaControls
				ref="localMediaControls"
				:model="localMediaModel"
				:local-call-participant-model="localCallParticipantModel"
				:screen-sharing-button-hidden="isSidebar"
				:quality-warning-aria-label="qualityWarningAriaLabel"
				:quality-warning-tooltip="qualityWarningTooltip"
				@switchScreenToId="$emit('switchScreenToId', $event)" />
		</transition>
	</div>
</template>

<script>
import attachMediaStream from 'attachmediastream'
import Avatar from '@nextcloud/vue/dist/Components/Avatar'
import LocalMediaControls from './LocalMediaControls'
import Hex from 'crypto-js/enc-hex'
import SHA1 from 'crypto-js/sha1'
import { showInfo, showError } from '@nextcloud/dialogs'
import video from '../../../mixins/video.js'
import VideoBackground from './VideoBackground'
import { callAnalyzer } from '../../../utils/webrtc/index'
import { CONNECTION_QUALITY } from '../../../utils/webrtc/analyzers/PeerConnectionAnalyzer'

export default {

	name: 'LocalVideo',

	components: {
		Avatar,
		LocalMediaControls,
		VideoBackground,
	},

	mixins: [video],

	props: {
		localMediaModel: {
			type: Object,
			required: true,
		},
		localCallParticipantModel: {
			type: Object,
			required: true,
		},
		useConstrainedLayout: {
			type: Boolean,
			default: false,
		},
		isStripe: {
			type: Boolean,
			default: false,
		},
		isSidebar: {
			type: Boolean,
			default: false,
		},
	},

	data() {
		return {
			callAnalyzer: callAnalyzer,
			qualityWarningInGracePeriodTimeout: null,
		}
	},

	computed: {

		videoContainerClass() {
			return {
				'speaking': this.localMediaModel.attributes.speaking,
				'video-container-grid': this.isGrid,
				'video-container-stripe': this.isStripe,
			}
		},

		userId() {
			return this.$store.getters.getUserId()
		},

		displayName() {
			return this.$store.getters.getDisplayName()
		},

		firstLetterOfGuestName() {
			const customName = this.guestName !== t('spreed', 'Guest') ? this.guestName : '?'
			return customName.charAt(0)
		},

		sessionHash() {
			return Hex.stringify(SHA1(this.localCallParticipantModel.attributes.peerId))
		},

		guestName() {
			return this.$store.getters.getGuestName(
				this.$store.getters.getToken(),
				this.sessionHash,
			)
		},

		avatarSize() {
			return this.useConstrainedLayout ? 64 : 128
		},

		avatarSizeClass() {
			return 'avatar-' + this.avatarSize + 'px'
		},

		localStreamVideoError() {
			return this.localMediaModel.attributes.localStream && this.localMediaModel.attributes.localStreamRequestVideoError
		},

		showQualityWarning() {
			return this.senderConnectionQualityIsBad || this.qualityWarningInGracePeriodTimeout
		},

		senderConnectionQualityIsBad() {
			return this.senderConnectionQualityAudioIsBad
				|| this.senderConnectionQualityVideoIsBad
				|| this.senderConnectionQualityScreenIsBad
		},

		senderConnectionQualityAudioIsBad() {
			return callAnalyzer
				&& (callAnalyzer.attributes.senderConnectionQualityAudio === CONNECTION_QUALITY.VERY_BAD
				 || callAnalyzer.attributes.senderConnectionQualityAudio === CONNECTION_QUALITY.NO_TRANSMITTED_DATA)
		},

		senderConnectionQualityVideoIsBad() {
			return callAnalyzer
				&& (callAnalyzer.attributes.senderConnectionQualityVideo === CONNECTION_QUALITY.VERY_BAD
				 || callAnalyzer.attributes.senderConnectionQualityVideo === CONNECTION_QUALITY.NO_TRANSMITTED_DATA)
		},

		senderConnectionQualityScreenIsBad() {
			return callAnalyzer
				&& (callAnalyzer.attributes.senderConnectionQualityScreen === CONNECTION_QUALITY.VERY_BAD
				 || callAnalyzer.attributes.senderConnectionQualityScreen === CONNECTION_QUALITY.NO_TRANSMITTED_DATA)
		},

		qualityWarningAriaLabel() {
			let label = ''
			if (!this.localMediaModel.attributes.audioEnabled && this.localMediaModel.attributes.videoEnabled && this.localMediaModel.attributes.localScreen) {
				label = t('spreed', 'Bad sent video and screen quality.')
			} else if (!this.localMediaModel.attributes.audioEnabled && this.localMediaModel.attributes.localScreen) {
				label = t('spreed', 'Bad sent screen quality.')
			} else if (!this.localMediaModel.attributes.audioEnabled && this.localMediaModel.attributes.videoEnabled) {
				label = t('spreed', 'Bad sent video quality.')
			} else if (this.localMediaModel.attributes.videoEnabled && this.localMediaModel.attributes.localScreen) {
				label = t('spreed', 'Bad sent audio, video and screen quality.')
			} else if (this.localMediaModel.attributes.localScreen) {
				label = t('spreed', 'Bad sent audio and screen quality.')
			} else if (this.localMediaModel.attributes.videoEnabled) {
				label = t('spreed', 'Bad sent audio and video quality.')
			} else {
				label = t('spreed', 'Bad sent audio quality.')
			}

			return label
		},

		qualityWarningTooltip() {
			if (!this.showQualityWarning) {
				return null
			}

			const tooltip = {}
			if (!this.localMediaModel.attributes.audioEnabled && this.localMediaModel.attributes.videoEnabled && this.localMediaModel.attributes.localScreen) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to see you. To improve the situation try to disable your video while doing a screenshare.')
				tooltip.actionLabel = t('spreed', 'Disable video')
				tooltip.action = 'disableVideo'
			} else if (!this.localMediaModel.attributes.audioEnabled && this.localMediaModel.attributes.localScreen) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to see your screen.')
				tooltip.actionLabel = ''
				tooltip.action = ''
			} else if (!this.localMediaModel.attributes.audioEnabled && this.localMediaModel.attributes.videoEnabled) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to see you.')
				tooltip.actionLabel = ''
				tooltip.action = ''
			} else if (this.localMediaModel.attributes.videoEnabled && this.localMediaModel.attributes.localScreen) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to understand and see you. To improve the situation try to disable your video while doing a screenshare.')
				tooltip.actionLabel = t('spreed', 'Disable video')
				tooltip.action = 'disableVideo'
			} else if (this.localMediaModel.attributes.localScreen) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to understand and see your screen. To improve the situation try to disable your screenshare.')
				tooltip.actionLabel = t('spreed', 'Disable screenshare')
				tooltip.action = 'disableScreenShare'
			} else if (this.localMediaModel.attributes.videoEnabled) {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to understand and see you. To improve the situation try to disable your video.')
				tooltip.actionLabel = t('spreed', 'Disable video')
				tooltip.action = 'disableVideo'
			} else {
				tooltip.content = t('spreed', 'Your internet connection or computer are busy and other participants might be unable to understand you.')
				tooltip.actionLabel = ''
				tooltip.action = ''
			}

			return tooltip
		},
	},

	watch: {

		localCallParticipantModel: {
			immediate: true,

			handler: function(localCallParticipantModel, oldLocalCallParticipantModel) {
				if (oldLocalCallParticipantModel) {
					oldLocalCallParticipantModel.off('forcedMute', this._handleForcedMute)
				}

				if (localCallParticipantModel) {
					localCallParticipantModel.on('forcedMute', this._handleForcedMute)
				}
			},
		},

		'localMediaModel.attributes.localStream': function(localStream) {
			this._setLocalStream(localStream)
		},

		localStreamVideoError: {
			immediate: true,

			handler: function(localStreamVideoError) {
				if (localStreamVideoError) {
					showError(t('spreed', 'Error while accessing camera'), {
						timeout: 0,
					})
				}
			},
		},

		senderConnectionQualityIsBad: function(senderConnectionQualityIsBad) {
			if (!senderConnectionQualityIsBad) {
				return
			}

			if (this.qualityWarningInGracePeriodTimeout) {
				window.clearTimeout(this.qualityWarningInGracePeriodTimeout)
			}

			this.qualityWarningInGracePeriodTimeout = window.setTimeout(() => {
				this.qualityWarningInGracePeriodTimeout = null
			}, 10000)
		},

	},

	mounted() {
		// Set initial state
		this._setLocalStream(this.localMediaModel.attributes.localStream)
	},

	destroyed() {
		if (this.localCallParticipantModel) {
			this.localCallParticipantModel.off('forcedMute', this._handleForcedMute)
		}
	},

	methods: {

		_handleForcedMute() {
			// The default toast selector is "body-user", but as this toast can
			// be shown to guests too a generic selector valid both for logged
			// in users and guests needs to be used instead (undefined selects
			// the body element).
			showInfo(t('spreed', 'You have been muted by a moderator'), { selector: undefined })
		},

		_setLocalStream(localStream) {
			if (!localStream) {
				// Do not clear the srcObject of the video element, just leave
				// the previous stream as a frozen image.

				return
			}

			const options = {
				autoplay: true,
				mirror: true,
				muted: true,
			}
			attachMediaStream(localStream, this.$refs.video, options)
		},

	},

}
</script>

<style lang="scss" scoped>
@import '../../../assets/variables.scss';
@import '../../../assets/avatar.scss';
@include avatar-mixin(64px);
@include avatar-mixin(128px);

.video-container-grid {
	position:relative;
	height: 100%;
	width: 100%;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.video-container-stripe {
	position:relative;
	height: 100%;
	flex: 0 0 300px;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.video {
	height: 100%;
	width: 100%;
}

.video--fit {
	/* Fit the frame */
	object-fit: contain;
}

.video--fill {
	/* Fill the frame */
	object-fit: cover;
}

.avatar-container {
	margin: auto;
}

</style>
