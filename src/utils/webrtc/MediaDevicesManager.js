/**
 *
 * @copyright Copyright (c) 2020, Daniel Calviño Sánchez (danxuliu@gmail.com)
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

/**
 * Wrapper for MediaDevices to simplify its use.
 *
 * The MediaDevicesManager keeps an updated list of devices that can be accessed
 * from "attributes.devices". Clients of this class must call
 * "enableDeviceEvents()" to start keeping track of the devices, and
 * "disableDeviceEvents()" once it is no longer needed. Eventually there must be
 * one call to "disableDeviceEvents()" for each call to "enableDeviceEvents()",
 * but several clients can be active at the same time.
 *
 * Each element of "attributes.devices" is an object with the following fields:
 * - deviceId: the unique identifier for the device
 * - groupId: two or more devices have the same groupId if they belong to the
 *   same physical device
 * - kind: either "audioinput", "videoinput" or "audiooutput"
 * - label: a human readable identifier for the device
 * - fallbackLabel: a generated label if the actual label is empty
 *
 * Note that the list may not contain some kind of devices due to browser
 * limitations (for example, currently Firefox does not list "audiooutput"
 * devices).
 *
 * The label may not be available if persistent media permissions have not been
 * granted and a MediaStream has not been active. In those cases the fallback
 * label can be used instead.
 *
 * "attributes.audioInputId" and "attributes.videoInputId" define the devices
 * that will be used when calling "getUserMedia(constraints)".
 *
 * The selected devices will be automatically cleared if they are no longer
 * available.
 */
export default function MediaDevicesManager() {
	this.attributes = {
		devices: [],

		audioInputId: undefined,
		videoInputId: undefined,
	}

	this._enabledCount = 0

	this._knownDevices = {}

	this._updateDevicesBound = this._updateDevices.bind(this)
}
MediaDevicesManager.prototype = {

	isSupported: function() {
		return navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.enumerateDevices
	},

	enableDeviceEvents: function() {
		this._enabledCount++

		this._updateDevices()

		navigator.mediaDevices.addEventListener('devicechange', this._updateDevicesBound)
	},

	disableDeviceEvents: function() {
		this._enabledCount--

		if (!this._enabledCount) {
			navigator.mediaDevices.removeEventListener('devicechange', this._updateDevicesBound)
		}
	},

	_updateDevices: function() {
		navigator.mediaDevices.enumerateDevices().then(devices => {
			const removedDevices = this.attributes.devices.filter(oldDevice => !devices.find(device => oldDevice.deviceId === device.deviceId && oldDevice.kind === device.kind))
			const updatedDevices = devices.filter(device => this.attributes.devices.find(oldDevice => device.deviceId === oldDevice.deviceId && device.kind === oldDevice.kind))
			const addedDevices = devices.filter(device => !this.attributes.devices.find(oldDevice => device.deviceId === oldDevice.deviceId && device.kind === oldDevice.kind))

			removedDevices.forEach(removedDevice => {
				this._removeDevice(removedDevice)
			})
			updatedDevices.forEach(updatedDevice => {
				this._updateDevice(updatedDevice)
			})
			addedDevices.forEach(addedDevice => {
				this._addDevice(addedDevice)
			})
		}).catch(function(error) {
			console.error('Could not update known media devices: ' + error.name + ': ' + error.message)
		})
	},

	_removeDevice: function(removedDevice) {
		if (removedDevice.kind === 'audioinput' && this.attributes.audioInputId === removedDevice.deviceId) {
			this.attributes.audioInputId = undefined
		} else if (removedDevice.kind === 'videoinput' && this.attributes.videoInputId === removedDevice.deviceId) {
			this.attributes.videoInputId = undefined
		}

		const removedDeviceIndex = this.attributes.devices.findIndex(oldDevice => oldDevice.deviceId === removedDevice.deviceId && oldDevice.kind === removedDevice.kind)
		if (removedDeviceIndex >= 0) {
			this.attributes.devices.splice(removedDeviceIndex, 1)
		}
	},

	_updateDevice: function(updatedDevice) {
		const oldDevice = this.attributes.devices.find(oldDevice => oldDevice.deviceId === updatedDevice.deviceId && oldDevice.kind === updatedDevice.kind)

		// Only update the label if it has a value, as it may have been
		// removed if there is currently no active stream.
		if (updatedDevice.label) {
			oldDevice.label = updatedDevice.label
		}

		// These should not have changed, but just in case
		oldDevice.groupId = updatedDevice.groupId
		oldDevice.kind = updatedDevice.kind
	},

	_addDevice: function(addedDevice) {
		// Copy the device to add, as its properties are read only and
		// thus they can not be updated later.
		addedDevice = {
			deviceId: addedDevice.deviceId,
			groupId: addedDevice.groupId,
			kind: addedDevice.kind,
			label: addedDevice.label,
		}

		const knownDevice = this._knownDevices[addedDevice.kind + '-' + addedDevice.deviceId]
		if (knownDevice) {
			addedDevice.fallbackLabel = knownDevice.fallbackLabel
			// If the added device has a label keep it; otherwise use
			// the previously known one, if any.
			addedDevice.label = addedDevice.label ? addedDevice.label : knownDevice.label
		} else {
			// Generate a fallback label to be used when the actual label is
			// not available.
			if (addedDevice.deviceId === 'default') {
				addedDevice.fallbackLabel = t('spreed', 'Default')
			} else if (addedDevice.kind === 'audioinput') {
				addedDevice.fallbackLabel = t('spreed', 'Microphone {number}', { number: Object.values(this._knownDevices).filter(device => device.kind === 'audioinput').length + 1 })
			} else if (addedDevice.kind === 'videoinput') {
				addedDevice.fallbackLabel = t('spreed', 'Camera {number}', { number: Object.values(this._knownDevices).filter(device => device.kind === 'videoinput').length + 1 })
			} else if (addedDevice.kind === 'audiooutput') {
				addedDevice.fallbackLabel = t('spreed', 'Speaker {number}', { number: Object.values(this._knownDevices).filter(device => device.kind === 'audioutput').length + 1 })
			}
		}

		// Always refresh the known device with the latest values.
		this._knownDevices[addedDevice.kind + '-' + addedDevice.deviceId] = addedDevice

		this.attributes.devices.push(addedDevice)
	},

	/**
	 * Wrapper for MediaDevices.getUserMedia to use the selected audio and video
	 * input devices.
	 *
	 * The selected audio and video input devices are used only if the
	 * constraints do not specify a device already. Otherwise the devices in the
	 * constraints are respected.
	 *
	 * @param {MediaStreamConstraints} constraints the constraints specifying
	 *        the media to request
	 * @returns {Promise} resolved with a MediaStream object when successful
	 */
	getUserMedia: function(constraints) {
		if (constraints.audio && !constraints.audio.deviceId && this.attributes.audioInputId) {
			if (!(constraints.audio instanceof Object)) {
				constraints.audio = {}
			}
			constraints.audio.deviceId = this.attributes.audioInputId
		}

		if (constraints.video && !constraints.video.deviceId && this.attributes.videoInputId) {
			if (!(constraints.video instanceof Object)) {
				constraints.video = {}
			}
			constraints.video.deviceId = this.attributes.videoInputId
		}

		return navigator.mediaDevices.getUserMedia(constraints)
	},
}
