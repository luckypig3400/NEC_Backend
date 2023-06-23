const express = require('express')
const router = express.Router()

const SCHEDULE = require('../../models/schedule')
const BLOOD = require('../../models/blood')
const REPORT = require('../../models/report')

router
    .route('/')
    .get(async (req, res) => {
        /* 	
            #swagger.tags = ['Schedule']
            #swagger.description = '取得排程' 
        */
        try {
            const { limit, offset, sort, desc, search, dateRange, status } = req.query

            if (!dateRange && status !== 'all') return res.status(400).json({ message: 'Need a date range' })

            const dateConditions =
                status !== 'all'
                    ? {
                          createdAt: {
                              $gte: new Date(JSON.parse(dateRange).from),
                              $lte: new Date(JSON.parse(dateRange).to),
                          },
                      }
                    : {}

            if (!limit || !offset) return res.status(400).json({ message: 'Need a limit and offset' })

            const searchRe = new RegExp(search)
            const searchQuery = search
                ? {
                      $or: [{ procedureCode: searchRe }, { patientID: searchRe }],
                  }
                : {}

            const schedule = await SCHEDULE.aggregate([
                { $match: dateConditions },
                { $match: searchQuery },
                {
                    $lookup: {
                        from: 'patients',
                        localField: 'patientID',
                        foreignField: 'id',
                        as: 'patient',
                    },
                },
                {
                    $lookup: {
                        from: 'reports',
                        let: { pid: '$reportID' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$_id', { $toObjectId: '$$pid' }],
                                    },
                                },
                            },
                        ],
                        as: 'report',
                    },
                },
                { $sort: { [sort]: Number(desc) } },
                { $skip: Number(limit) * Number(offset) },
                { $limit: Number(limit) },
                {
                    $addFields: {
                        patient: { $arrayElemAt: ['$patient', 0] },
                        report: { $arrayElemAt: ['$report', 0] },
                    },
                },
            ])

            const count = await SCHEDULE.find({ ...searchQuery, ...dateConditions }).countDocuments()

            return res.status(200).json({ results: schedule, count })
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .post(async (req, res) => {
        /* 	
            #swagger.tags = ['Schedule']
            #swagger.description = '新增排程' 
        */
        try {
            let schedule = new SCHEDULE(req.body)
            schedule = await schedule.save()
            return res.status(200).json(schedule)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .patch(async (req, res) => {
        try {
            const { patientID, scheduleID, status } = req.body
            const schedule = await SCHEDULE.findOneAndUpdate(
                { _id: scheduleID },
                { $set: { status } },
                { returnDocument: 'after' }
            )
            // if (patientID) {
            //     await REPORT.findOneAndDelete({ patientID, status: 'pending' })
            //     await BLOOD.findOneAndDelete({ patientID })
            // }

            if (!schedule) return res.status(404).json({ message: '找不到排程資料' })
            return res.status(200).json(schedule)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .delete(async (req, res) => {
        try {
            const { scheduleID } = req.body
            const schedule = await SCHEDULE.findOneAndDelete({ _id: scheduleID })
            await REPORT.findOneAndDelete({ _id: schedule.reportID })
            if (!schedule) return res.status(404).json({ message: '找不到排程資料' })
            return res.status(200).json(schedule)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })

router
    .route('/:_id')
    .patch(async (req, res) => {
        /* 	
            #swagger.tags = ['Schedule']
            #swagger.description = '修改排程' 
        */
        try {
            const { _id } = req.params
            const schedule = await SCHEDULE.findOneAndUpdate(
                { _id: _id },
                { $set: { ...req.body } },
                { returnDocument: 'after' }
            )
            return res.status(200).json(schedule)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .delete(async (req, res) => {
        /* 	
        #swagger.tags = ['Schedule']
        #swagger.description = '刪除排程' 
    */
        try {
            const { _id } = req.params
            const schedule = await SCHEDULE.findOneAndDelete({ _id })
            if (!schedule) return res.status(404).json({ message: '找不到報告資料' })
            return res.status(200).json(schedule)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })

module.exports = router
