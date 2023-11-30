//
//  FFPlayStateFactory.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class FFPlayStateFactory {
    private static var selectQuestion: FFPlayState?
    
    private static var faceOff: FFPlayState?
    
    private static var familyPlay: FFPlayState?
    
    private static var familySteal: FFPlayState?
    
    private static var allocatePoints: FFPlayState?
    
    private static var revealAnswers: FFPlayState?
    
    public static func getState(type: FFPlayStateType, data: Any?) -> FFPlayState? {
        switch type {
        case .SELECT_QUESTION:
            if (self.selectQuestion == nil) {
                if data is QuestionSet.Type {
                    createSelectQuestionState(questions: data as! QuestionSet)
                } else {
                    //TODO: InvalidDataException
                    fatalError("InvalidDataException not implemented")
                }
            }
            return self.selectQuestion
        case .FACE_OFF:
            if(self.faceOff == nil) {
                if (data is QuestionSet) {
                    self.createFaceOffState(questions: data as! QuestionSet)
                } else {
                    //TODO: InvalidDataException
                    fatalError("InvalidDataException not implemented")
                }
            }
            return self.faceOff
        case .FAMILY_PLAY:
            if (self.familyPlay == nil) { self.createFamilyPlayState() }
            return self.familyPlay
        case .FAMILY_STEAL:
            if (self.familySteal == nil) { self.createFamilyStealState() }
            return self.familySteal
        case .ALLOCATE_POINTS:
            if (self.allocatePoints == nil) {
                if (data is FamilyCollection) {
                    self.createAllocatePointsState(families: data as! FamilyCollection)
                } else {
                    //TODO: InvalidDataException
                    fatalError("InvalidDataException not implemented")
                }
            }
            return self.allocatePoints
        case .REVEAL_ANSWERS:
            if (self.revealAnswers == nil) { self.createRevealAnswersState() }
            return self.revealAnswers
        }
        return nil
    }
    
    private static func createSelectQuestionState(questions: QuestionSet) { self.selectQuestion = StateSelectQuestion(questions: questions) }
    
    private static func createRevealAnswersState() { self.revealAnswers = StateRevealAnswers() }

    private static func createFamilyStealState() { self.familySteal = StateFamilySteal() }

    private static func createFamilyPlayState() { self.familyPlay = StateFamilyPlay(); }

    private static func createFaceOffState(questions: QuestionSet) { self.faceOff = StateFaceOff(questions: questions) }

    private static func createAllocatePointsState(families: FamilyCollection) { self.allocatePoints = StateAllocatePoints(families: families) }
}
