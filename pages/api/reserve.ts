import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/client';
import prisma from '../../lib/prisma';
import * as dateMath from 'date-arithmetic';
import Config from '../../lib/Config';
import { RESERVATION_DURATION } from '../../lib/const';

export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'PUT' && req.method !== 'DELETE') {
        res.status(405).json({ result: 'error' });
        return;
    }

    const session = await getSession({ req });

    if (!session) {
        res.status(401).json({ result: 'error' });
        return;
    }

    if (req.method === 'PUT') {
        const date = new Date(req.body?.date);
        const numberOfAdults = parseInt(req.body?.numberOfAdults, 10);
        const numberOfChildren = parseInt(req.body?.numberOfChildren, 10);

        if (isNaN(date.getTime()) ||
            isNaN(numberOfAdults) ||
            isNaN(numberOfChildren) ||
            numberOfAdults < 1 ||
            numberOfAdults > Config.MAX_ADULTS ||
            numberOfChildren < 0 ||
            numberOfChildren > Config.MAX_CHILDREN) {
            res.status(400).json({ result: 'error', message: 'Invalid date or number of children / adults' });
            return;
        }

        const slot = await prisma.slot.findUnique({
            where: {
                date
            }
        });

        if (!slot) {
            res.status(400).json({ result: 'error', message: 'Slot does not exist' });
            return;
        }

        const numberOfReservations = await prisma.reservation.count({
            where: {
                date,
                expiresOn: {
                    gte: new Date(),
                }
            }
        });
        const numberOfBookings = await prisma.booking.count({
            where: {
                date,
            }
        });

        if ((numberOfBookings + numberOfReservations + numberOfAdults + numberOfChildren) > slot.seats) {
            res.status(409).json({ result: 'conflict' });
            return;
        }

        const hasBookings = await prisma.booking.count({
            where: {
                email: session.user.email,
            },
        }) > 0;

        if (hasBookings) {
            res.status(409).json({ result: 'booked' });
            return;
        }

        await Promise.all(Array.from({
            length: numberOfChildren + numberOfAdults,
        }, (_, i) => prisma.reservation.create({
            data: {
                date,
                email: session.user.email,
                adult: i < numberOfAdults,
                expiresOn: dateMath.add(new Date(), RESERVATION_DURATION, 'minutes'),
            }
        })));

        res.status(200).json({ result: 'success' });
    } else if(req.method === 'DELETE') {
        await prisma.reservation.deleteMany({
            where: {
                email: session.user.email,
            }
        });

        res.status(200).json({ result: 'success' });
    }
}