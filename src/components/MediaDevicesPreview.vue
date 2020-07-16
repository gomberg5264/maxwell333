<!--
  - @copyright Copyright (c) 2020, Daniel Calviño Sánchez (danxuliu@gmail.com)
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
	<div class="mediaDevicesPreview">
		<MediaDevicesSelector kind="audioinput"
			:devices="devices"
			:device-id="audioInputId"
			:enabled="enabled"
			@update:deviceId="audioInputId = $event" />
		<div class="preview preview-audio">
			<div v-if="!audioPreviewAvailable">
				<div v-if="!audioInputId"
					class="preview-not-available icon icon-audio-off" />
				<div v-else-if="!enabled"
					class="preview-not-available icon icon-audio" />
				<div v-else-if="audioStreamError"
					class="preview-not-available icon icon-error" />
				<div v-else-if="!audioStream"
					class="preview-not-available icon icon-loading" />
			</div>
			<!-- v-show has to be used instead of v-if/else to ensure that the
				 reference is always valid once mounted. -->
			<div v-show="audioPreviewAvailable"
				class="volume-indicator-wrapper">
				<div class="icon icon-audio" />
				<span ref="volumeIndicator"
					class="volume-indicator"
					:style="{ 'height': currentVolumeIndicatorHeight + 'px' }" />
			</div>
		</div>
		<MediaDevicesSelector kind="videoinput"
			:devices="devices"
			:device-id="videoInputId"
			:enabled="enabled"
			@update:deviceId="videoInputId = $event" />
		<div class="preview preview-video">
			<div v-if="!videoPreviewAvailable">
				<div v-if="!videoInputId"
					class="preview-not-available icon icon-video-off" />
				<div v-else-if="!enabled"
					class="preview-not-available icon icon-video" />
				<div v-else-if="videoStreamError"
					class="preview-not-available icon icon-error" />
				<div v-else-if="!videoStream"
					class="preview-not-available icon icon-loading" />
			</div>
			<!-- v-show has to be used instead of v-if/else to ensure that the
				 reference is always valid once mounted. -->
			<video v-show="videoPreviewAvailable"
				ref="video"
				tabindex="-1" />
		</div>
	</div>
</template>

<script>
import attachMediaStream from 'attachmediastream'
import hark from 'hark'
import { mediaDevicesManager } from '../utils/webrtc/index'
import MediaDevicesSelector from './MediaDevicesSelector'

export default {

	name: 'MediaDevicesPreview',

	components: {
		MediaDevicesSelector,
	},

	props: {
		enabled: {
			type: Boolean,
			required: true,
		},
	},

	data() {
		return {
			mounted: false,
			mediaDevicesManager: mediaDevicesManager,
			audioStream: null,
			audioStreamError: false,
			videoStream: null,
			videoStreamError: false,
			hark: null,
			currentVolume: -100,
			volumeThreshold: -100,
		}
	},

	computed: {
		devices() {
			return mediaDevicesManager.attributes.devices
		},

		audioInputId: {
			get() {
				return mediaDevicesManager.attributes.audioInputId
			},
			set(value) {
				mediaDevicesManager.attributes.audioInputId = value
			},
		},

		videoInputId: {
			get() {
				return mediaDevicesManager.attributes.videoInputId
			},
			set(value) {
				mediaDevicesManager.attributes.videoInputId = value
			},
		},

		audioPreviewAvailable() {
			return this.audioInputId && this.audioStream
		},

		videoPreviewAvailable() {
			return this.videoInputId && this.videoStream
		},

		currentVolumeIndicatorHeight() {
			// refs can not be accessed on the initial render, only after the
			// component has been mounted.
			if (!this.mounted) {
				return 0
			}

			// WebRTC volume goes from -100 (silence) to 0 (loudest sound in the
			// system); for the volume indicator only sounds above the threshold
			// are taken into account.
			let currentVolumeProportion = 0
			if (this.currentVolume > this.volumeThreshold) {
				currentVolumeProportion = (this.volumeThreshold - this.currentVolume) / this.volumeThreshold
			}

			const volumeIndicatorStyle = window.getComputedStyle ? getComputedStyle(this.$refs.volumeIndicator, null) : this.$refs.volumeIndicator.currentStyle

			const maximumVolumeIndicatorHeight = this.$refs.volumeIndicator.parentElement.clientHeight - (parseInt(volumeIndicatorStyle.bottom, 10) * 2)

			return maximumVolumeIndicatorHeight * currentVolumeProportion
		},

	},

	watch: {
		enabled(enabled) {
			if (this.enabled) {
				this.mediaDevicesManager.enableDeviceEvents()
				this.updateAudioStream()
				this.updateVideoStream()
			} else {
				this.mediaDevicesManager.disableDeviceEvents()
				this.stopAudioStream()
				this.stopVideoStream()
			}
		},

		audioInputId(audioInputId) {
			if (!this.enabled) {
				return
			}

			this.updateAudioStream()
		},

		videoInputId(videoInputId) {
			if (!this.enabled) {
				return
			}

			this.updateVideoStream()
		},
	},

	mounted() {
		this.mounted = true
	},

	destroyed() {
		this.stopAudioStream()
		this.stopVideoStream()

		if (this.enabled) {
			this.mediaDevicesManager.disableDeviceEvents()
		}
	},

	methods: {

		updateAudioStream() {
			// When the audio input device changes the previous stream must be
			// stopped before a new one is requested, as for example currently
			// Firefox does not support having two different audio input devices
			// active at the same time:
			// https://bugzilla.mozilla.org/show_bug.cgi?id=1468700
			this.stopAudioStream()

			if (!this.audioInputId) {
				return
			}

			this.mediaDevicesManager.getUserMedia({ audio: true })
				.then(stream => {
					this.audioStreamError = false
					this.setAudioStream(stream)
				})
				.catch(() => {
					this.audioStreamError = true
					this.setAudioStream(null)
				})
		},

		updateVideoStream() {
			// Video stream is stopped too to avoid potential issues similar to
			// the audio ones (see "updateAudioStream").
			this.stopVideoStream()

			if (!this.videoInputId) {
				return
			}

			this.mediaDevicesManager.getUserMedia({ video: true })
				.then(stream => {
					this.videoStreamError = false
					this.setVideoStream(stream)
				})
				.catch(() => {
					this.videoStreamError = true
					this.setVideoStream(null)
				})
		},

		setAudioStream(audioStream) {
			this.audioStream = audioStream

			if (!audioStream) {
				return
			}

			this.hark = hark(this.audioStream)
			this.hark.on('volume_change', (volume, volumeThreshold) => {
				this.currentVolume = volume
				this.volumeThreshold = volumeThreshold
			})
		},

		setVideoStream(videoStream) {
			this.videoStream = videoStream

			if (!this.$refs.video) {
				return
			}

			if (!videoStream) {
				return
			}

			const options = {
				autoplay: true,
				mirror: true,
				muted: true,
			}
			attachMediaStream(videoStream, this.$refs.video, options)
		},

		stopAudioStream() {
			if (!this.audioStream) {
				return
			}

			this.audioStream.getTracks().forEach(function(track) {
				track.stop()
			})

			this.audioStream = null

			if (this.hark) {
				this.hark.stop()
				this.hark.off('volume_change')
				this.hark = null
			}
		},

		stopVideoStream() {
			if (!this.videoStream) {
				return
			}

			this.videoStream.getTracks().forEach(function(track) {
				track.stop()
			})

			this.videoStream = null

			if (this.$refs.video) {
				this.$refs.video.srcObject = null
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.preview {
	display: flex;
	justify-content: center;

	.icon {
		background-size: 64px;
		width: 64px;
		height: 64px;
		opacity: 0.4;
	}
}

.preview-audio {
	.volume-indicator-wrapper {
		/* Make the wrapper the positioning context of the volume indicator. */
		position: relative;
	}

	.icon {
		margin-top: 16px;
		margin-bottom: 16px;

		/* Icon width plus volume indicator width on both sides to keep the icon
		 * centered. */
		width: 66px;
	}

	.volume-indicator {
		position: absolute;

		width: 6px;
		right: 0;

		margin-bottom: 16px;

		/* The button height is 64px; the volume indicator button is 56px at
		 * maximum, but its value will be changed based on the current volume;
		 * the height change will reveal more or less of the gradient, which has
		 * absolute dimensions and thus does not change when the height
		 * changes. */
		height: 54px;
		bottom: 4px;

		background: linear-gradient(0deg, green, yellow, red 54px);

		opacity: 0.7;
	}
}

.preview-video {
	.preview-not-available {
		margin-top: 64px;
		margin-bottom: 64px;
	}

	video {
		display: block;
		max-height: 192px;
	}
}
</style>
