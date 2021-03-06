<?php

declare(strict_types=1);
/**
 * @copyright Copyright (c) 2020, Joas Schilling <coding@schilljs.com>
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

namespace OCA\Talk\BackgroundJob;

use OC\BackgroundJob\TimedJob;
use OCA\Talk\Manager;
use OCP\ICache;
use OCP\ICacheFactory;

class ResetAssignedSignalingServer extends TimedJob {

	/** @var Manager */
	protected $manager;
	/** @var ICache */
	protected $cache;

	public function __construct(Manager $manager,
								ICacheFactory $cacheFactory) {
		// Every 5 minutes
		$this->setInterval(60 * 5);

		$this->manager = $manager;
		$this->cache = $cacheFactory->createDistributed('hpb_servers');
	}

	protected function run($argument): void {
		$this->manager->resetAssignedSignalingServers($this->cache);
	}
}
